"""MQTT coordinator for the ESP32 split-flap master.

The integration owns all entities.  The master only publishes state on
``<prefix>/status`` and accepts commands on ``<prefix>/command/*``; all
translation from board characters to per-module targets happens here.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import zlib
from typing import Any

from homeassistant.components import mqtt
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    COMMAND_TOPICS,
    CONF_TOPIC_PREFIX,
    COORDINATOR_STORAGE_VERSION,
    DEFAULT_DEVICE_NAME,
    DEFAULT_TOPIC_PREFIX,
    DOMAIN,
    MQTT_COMPAT,
    OFFLINE_TIMEOUT_SECONDS,
    PANEL_URL_PATH,
    STORAGE_SAVE_DELAY,
    signal_update,
)
from .master_ota import (
    MASTER_OTA_CHUNK_BYTES,
    MASTER_OTA_CHUNK_PAUSE_SECONDS,
    MASTER_OTA_MAX_SIZE,
    MASTER_OTA_STATES_ACTIVE,
)
from .module_status import (
    ModuleStatus,
    coerce_optional_int,
    module_payload_id,
    valid_drum,
)
from .ota import OTA_APP_MAX_SIZE, OTA_CHUNK_BYTES, OTA_STATES_ACTIVE
from .positions import POSITION_MAP_UNSET

_LOGGER = logging.getLogger(__name__)


class SplitFlapCoordinator:
    """Own the MQTT connection and the last known hardware state."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.prefix = (
            entry.options.get(
                CONF_TOPIC_PREFIX,
                entry.data.get(CONF_TOPIC_PREFIX, DEFAULT_TOPIC_PREFIX),
            )
            .strip()
            .rstrip("/")
        )
        self.signal = signal_update(entry.entry_id)
        self._pre_simulation_status: str | None = None

        # Transport-level state stays here; everything derived from the
        # master's status payload lives in the HA-free ModuleStatus module.
        self.data: dict[str, Any] = {
            "status": "offline",
            "text": "",
            "last_status": None,
            "restored": False,
        }
        self.status = ModuleStatus(drum_provider=self._default_drum_setting)

        self._mqtt_unsub: CALLBACK_TYPE | None = None
        self._offline_timer: CALLBACK_TYPE | None = None
        self._store: Store[dict[str, Any]] = Store(
            hass, COORDINATOR_STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )

    def _default_drum_setting(self) -> str | None:
        """HA-side adapter for the configured fallback drum."""

        try:
            runtime = self.hass.data.get(DOMAIN, {}).get(self.entry.entry_id)
            if runtime:
                engine = runtime.get("engine")
                if engine is not None:
                    settings = getattr(engine, "settings", {}) or {}
                    default = settings.get("default_drum")
                    if isinstance(default, str):
                        return default
        except Exception:  # noqa: BLE001
            pass
        return None

    # ------------------------------------------------------------------
    # Identity / snapshots
    # ------------------------------------------------------------------
    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self.entry.entry_id)},
            name=self.entry.title or DEFAULT_DEVICE_NAME,
            manufacturer="DIY",
            model="ESP32-C3 RS485 Split-Flap Master",
            sw_version=self.master_version or "MQTT",
            configuration_url=f"homeassistant://{PANEL_URL_PATH}",
        )

    @property
    def simulation_enabled(self) -> bool:
        return bool(getattr(self.status, "simulated", False))

    @property
    def simulated_module_count(self) -> int:
        return int(getattr(self.status, "simulated_count", 0))

    @property
    def real_modules_count(self) -> int:
        fallback = getattr(self.status, "modules_count", 0)
        return int(getattr(self.status, "real_modules_count", fallback))

    @callback
    def set_simulation(self, count: int | str | None) -> None:
        """Switch the offline simulator on (count > 0) or off (0)."""

        was_simulated = self.simulation_enabled
        self.status.set_simulated(count)
        if self.simulation_enabled:
            if not was_simulated:
                self._pre_simulation_status = str(
                    self.data.get("status", "offline")
                )
            self.data = {**self.data, "status": "simulated"}
        elif was_simulated:
            # Restore the transport status that was in force before the
            # simulator took over; a fresh heartbeat may not arrive for a while.
            self.data = {
                **self.data,
                "status": self._pre_simulation_status or "offline",
            }
            self._pre_simulation_status = None
        self._notify()

    @property
    def online(self) -> bool:
        if self.simulation_enabled:
            return True
        return str(self.data.get("status", "offline")).lower() == "online"

    @property
    def desired_chars(self) -> dict[str, str]:
        return self.status.desired_chars

    @property
    def modules(self) -> dict[str, dict[str, Any]]:
        return self.status.modules

    @property
    def module_ids(self) -> list[str]:
        return self.status.module_ids

    @property
    def modules_count(self) -> int:
        return self.status.modules_count

    @property
    def master_ota(self) -> dict[str, Any]:
        """Normalized ESP32 self-update status (always present)."""

        return self.status.master_ota

    @property
    def master_ip(self) -> str | None:
        """Last address reported for manual ArduinoOTA recovery."""

        return self.status.master_ip

    @property
    def master_version(self) -> str | None:
        """Version the master reports, or ``None`` for older firmware."""

        return self.status.master_version

    @property
    def master_bus_compat(self) -> int | None:
        """Bus compatibility generation the master reports, or ``None``."""

        return self.status.master_bus_compat

    @property
    def master_mqtt_compat(self) -> int | None:
        """MQTT compatibility generation the master reports, or ``None``."""

        return self.status.master_mqtt_compat

    @property
    def master_compat(self) -> int | None:
        """Alias for :attr:`master_mqtt_compat` (older panel code)."""

        return self.master_mqtt_compat

    @property
    def mqtt_compat_ok(self) -> bool | None:
        """Whether the master speaks this integration's MQTT JSON generation.

        ``None`` means the master has not reported a generation (firmware
        predating the version protocol); that is "unknown", not "compatible".
        """

        return self.status.compat_ok(MQTT_COMPAT)

    @property
    def compat_ok(self) -> bool | None:
        """Alias for :attr:`mqtt_compat_ok`."""

        return self.mqtt_compat_ok

    def flap_list_for(self, module_id: Any) -> list[str] | None:
        """Return the module's reported drum, or ``None`` when unknown."""

        return self.status.flap_list_for(module_id)

    def drum_for(self, module_id: Any) -> list[str]:
        return self.status.effective_drum(module_id)

    def get_effective_drum(self, module_id: Any) -> list[str]:
        """Return the effective drum for a module (reported > default > stock)."""

        return self.status.effective_drum(module_id)

    def module_snapshot(self, module_id: str) -> dict[str, Any]:
        return self.status.module_snapshot(module_id, master_online=self.online)

    def snapshot(self) -> dict[str, Any]:
        simulated = self.simulation_enabled
        return self.status.snapshot(
            prefix=self.prefix,
            online=self.online,
            status="simulated" if simulated else str(self.data.get("status", "offline")),
            text="" if simulated else str(self.data.get("text") or ""),
            last_status=self.data.get("last_status"),
            restored=bool(self.data.get("restored", False)),
            mqtt_compat=MQTT_COMPAT,
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def async_setup(self) -> None:
        await self._async_restore_state()

        status_topic = f"{self.prefix}/status"

        @callback
        def message_received(msg) -> None:
            try:
                payload = json.loads(msg.payload)
            except (json.JSONDecodeError, UnicodeDecodeError):
                _LOGGER.error("Failed to decode MQTT status payload: %s", msg.payload)
                return
            if not isinstance(payload, dict):
                _LOGGER.warning("MQTT status payload is not an object: %s", payload)
                return
            self._handle_status_payload(payload)

        self._mqtt_unsub = await mqtt.async_subscribe(
            self.hass, status_topic, message_received
        )
        _LOGGER.info("Subscribed to %s", status_topic)
        self._reset_offline_timer()
        await self.async_sync()

    async def async_unload(self) -> None:
        try:
            await self._store.async_save(self._state_snapshot())
        except Exception:  # noqa: BLE001 - unload must continue
            _LOGGER.exception("Could not save Split-Flap state")

        if self._offline_timer is not None:
            self._offline_timer()
            self._offline_timer = None
        if self._mqtt_unsub is not None:
            self._mqtt_unsub()
            self._mqtt_unsub = None

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------
    def _state_snapshot(self) -> dict[str, Any]:
        state = self.status.persisted()
        state["text"] = str(self.data.get("text") or "")
        state["saved_at"] = dt_util.now(dt_util.UTC).isoformat()
        return state

    def _schedule_save(self) -> None:
        self._store.async_delay_save(self._state_snapshot, STORAGE_SAVE_DELAY)

    async def _async_restore_state(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception:  # noqa: BLE001 - restore must never block setup
            _LOGGER.exception("Could not restore Split-Flap state")
            return
        if not self.status.restore(stored):
            return

        self.data.update(
            {
                "text": str(stored.get("text") or ""),
                "status": "offline",
                "restored": True,
            }
        )
        _LOGGER.info(
            "Restored %s module(s) for %s from storage",
            self.modules_count,
            self.prefix,
        )

    # ------------------------------------------------------------------
    # MQTT receive
    # ------------------------------------------------------------------
    @callback
    def _handle_status_payload(self, payload: dict[str, Any]) -> None:
        if self.simulation_enabled:
            # The simulator owns the board entirely; do not let a live master
            # heartbeat overwrite virtual state or transport status.
            return
        data = dict(self.data)
        state_text = str(payload.get("state", "online")).lower()
        online = state_text not in {"offline", "unavailable", "disconnected"}
        data["status"] = "online" if online else "offline"

        if online and not self.simulation_enabled and isinstance(payload.get("text"), str):
            data["text"] = payload["text"]

        # Version aliases, module identity, flap derivation, drum priority and
        # OTA validation all live in the HA-free ModuleStatus module.
        self.status.ingest(payload, online=online)

        data["last_status"] = dt_util.now().isoformat()
        data["restored"] = False if online else bool(data.get("restored", False))
        self.data = data

        self._notify()
        self._schedule_save()
        self._reset_offline_timer()
        _LOGGER.debug(
            "Split-Flap status: %s module(s), %s", self.modules_count, data["status"]
        )

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, self.signal)

    @callback
    def _reset_offline_timer(self) -> None:
        if self._offline_timer is not None:
            self._offline_timer()
            self._offline_timer = None

        @callback
        def _timeout(_now) -> None:
            self._offline_timer = None
            if self.simulation_enabled or not self.online:
                return
            _LOGGER.warning(
                "No status from Split-Flap (%s) for %ss; marking offline",
                self.prefix,
                OFFLINE_TIMEOUT_SECONDS,
            )
            data = dict(self.data)
            data["status"] = "offline"
            self.data = data
            self._notify()

        self._offline_timer = async_call_later(
            self.hass, OFFLINE_TIMEOUT_SECONDS, _timeout
        )

    # ------------------------------------------------------------------
    # MQTT publish
    # ------------------------------------------------------------------
    async def _publish(self, command: str, payload: dict[str, Any]) -> None:
        if self.simulation_enabled:
            _LOGGER.debug("Simulation active; suppressing %s command", command)
            return
        topic = f"{self.prefix}/{COMMAND_TOPICS[command]}"
        await mqtt.async_publish(self.hass, topic, json.dumps(payload))
        _LOGGER.debug("Published to %s: %s", topic, payload)

    async def async_show_chars(
        self,
        char_by_id: dict[str, str],
        order_ids: list[str] | None = None,
        *,
        speed: int | None = None,
    ) -> None:
        """Send one character per module, in the requested send order."""

        ordered: list[str] = []
        seen: set[str] = set()
        for module_id in order_ids or []:
            key = str(module_id)
            if key in char_by_id and key not in seen:
                ordered.append(key)
                seen.add(key)
        for key in char_by_id:
            if key not in seen:
                ordered.append(str(key))
                seen.add(str(key))

        modules = [
            {
                "id": module_payload_id(key),
                "char": (char_by_id.get(key) or " ")[:1] or " ",
            }
            for key in ordered
        ]
        if not modules:
            _LOGGER.warning("Cannot display: no modules known yet")
            return

        payload: dict[str, Any] = {"modules": modules}
        # The current master ignores this, but it is part of the historical
        # display contract and newer firmware can honour it.
        if speed is not None:
            payload["speed"] = int(speed)

        await self._publish("display", payload)
        for key in ordered:
            self.desired_chars[key] = (char_by_id.get(key) or " ")[:1] or " "
        self._notify()

    async def async_sync(self) -> None:
        await self._publish("sync", {"action": "fetch_state"})

    async def async_scan(self) -> None:
        await self._publish("scan", {"action": "scan"})

    async def async_update(self) -> None:
        await self._publish("update", {"action": "update_data"})

    async def async_calibrate(
        self,
        *,
        module_id: int | str,
        action: str,
        index: int | None = None,
        flap: str | None = None,
        home_offset: int | None = None,
        positions: dict[str, Any] | None = None,
        clear_map: bool = False,
        steps: int | None = None,
        drum: str | None = None,
    ) -> dict[str, Any] | None:
        """Publish one calibration command to the master.

        Returns ``{"ok": ..., "verified": ...}`` for a drum write once the
        readback has been checked; ``None`` for every other action.
        """

        cleaned_positions: dict[int, int] = {}
        if isinstance(positions, dict):
            for key, value in positions.items():
                entry_index = coerce_optional_int(key)
                entry_position = coerce_optional_int(value)
                if (
                    entry_index is not None
                    and 0 <= entry_index < 64
                    and entry_position is not None
                    # POSITION_MAP_UNSET (0xFFFF) is accepted here on purpose:
                    # writing it to the slave clears that map entry (the slave
                    # stores 0xFFFF as "unset").  This is the documented way
                    # to clear a single entry; see README "Position maps".
                    and 0 <= entry_position <= POSITION_MAP_UNSET
                ):
                    cleaned_positions[entry_index] = entry_position

        action_norm = str(action).lower().strip().replace("-", "_")
        if action_norm in {"getpos", "get_position", "get_pos", "position", "pos", "get"}:
            action_norm = "get_pos"
        if action_norm in {"clearmap", "clear_map"}:
            action_norm = "clear_map"
        if action_norm in {"drumwrite", "writedrum", "drum_write", "write_drum"}:
            action_norm = "drum_write"

        payload: dict[str, Any] = {
            "action": action_norm,
            "module": module_payload_id(module_id),
        }
        if action_norm == "goto":
            if index is not None:
                payload["index"] = int(index)
            elif flap:
                payload["flap"] = str(flap)[0]
        elif action_norm == "step" and steps is not None:
            step_value = coerce_optional_int(steps)
            if step_value is None:
                raise ValueError("steps must be an integer")
            # The slave `g<pos>` command is an absolute position, while the
            # integration/UI exposes a relative step count.  Convert here so a
            # negative value (for example -32) can never wrap to the end of the
            # drum by accident.
            module = self.modules.get(str(module_id)) or {}
            current_step = coerce_optional_int(module.get("current_step"))
            total_steps = coerce_optional_int(module.get("total_steps"))
            if current_step is not None and total_steps and total_steps > 0:
                payload["steps"] = (current_step + step_value) % total_steps
            else:
                _LOGGER.warning(
                    "Relative step for module %s requested before its position "
                    "is known; sending %s as an absolute position",
                    module_id,
                    step_value,
                )
                payload["steps"] = step_value
        elif action_norm == "record" and index is not None:
            payload["index"] = int(index)
        elif action_norm == "apply":
            if home_offset is not None:
                payload["home_offset"] = int(home_offset)
            if clear_map:
                payload["clear_map"] = True
            if cleaned_positions:
                payload["positions"] = {
                    str(key): value for key, value in sorted(cleaned_positions.items())
                }
        elif action_norm == "drum_write":
            # All drum-write aliases were normalized to "drum_write" above.
            if valid_drum(drum):
                payload["action"] = "drum_write"
                payload["drum"] = drum
            else:
                raise ValueError(
                    "drum must be a 64-character string without line breaks"
                )

        if self.simulation_enabled:
            # The publish is suppressed by _publish; do not wait for a readback
            # from hardware that was never asked to write anything.
            if action_norm == "drum_write" and valid_drum(drum):
                return {"ok": True, "verified": True}
            return None

        await self._publish("calibrate", payload)

        # The master writes the 64 characters, re-queries the module and
        # republishes its status (a few seconds of bus time). Wait for that
        # readback so the caller learns whether the EEPROM really took the
        # drum instead of optimistically reporting success.
        if action_norm == "drum_write" and isinstance(drum, str):
            return await self._wait_for_drum(module_id, drum)
        return None

    # ------------------------------------------------------------------
    # Slave-module OTA
    # ------------------------------------------------------------------

    async def async_firmware_begin(self, module_id: int | str) -> None:
        """Start collecting a firmware image for one module.

        The master keeps the chunks until ``flash`` or ``cancel``; repeat
        ``begin`` to restart an aborted collection.
        """
        await self._publish("firmware", {"action": "begin", "module": module_payload_id(module_id)})

    async def async_firmware_chunk(self, data: bytes | str) -> None:
        """Append base64 image bytes to the collection.

        The decoded data must be the raw application image of the slave's
        ``ATtiny1616_OTA`` build (linked at 0x0800, gaps 0xFF). Chunks may
        split the image anywhere; keep each message well under the master's
        2048-byte MQTT buffer (~1 KB of base64 per message is safe).
        """
        encoded = data if isinstance(data, str) else base64.b64encode(data).decode("ascii")
        await self._publish("firmware", {"action": "chunk", "data": encoded})

    async def async_firmware_flash(self) -> None:
        """Flash the collected image to the module.

        The session blocks the master's display loop for ~20-25 s; the
        display/scan/update/calibrate commands are refused while it runs
        and the ``ota`` status object tracks progress.
        """
        await self._publish("firmware", {"action": "flash"})

    async def async_firmware_cancel(self) -> None:
        """Abort a running flash session or discard a collected image."""
        await self._publish("firmware", {"action": "cancel"})

    async def async_firmware_reset(self, module_id: int | str) -> None:
        """Boot a module stuck in the bootloader back into its application."""
        await self._publish("firmware", {"action": "reset", "module": module_payload_id(module_id)})

    async def async_flash_image(
        self, module_id: int | str, image: bytes
    ) -> dict[str, Any]:
        """Ship a complete application image and start the flash session.

        ``image`` must be the raw application region of the slave's
        ``ATtiny1616_OTA`` build (see ``firmware.image_from_hex``). The
        whole image is collected by the master first, so a failure before
        ``flash`` leaves the module untouched. Once the session starts the
        display loop is paused for roughly 20-25 s; progress is reported
        through the ``ota`` status object.
        """

        payload_id = module_payload_id(module_id)
        if not isinstance(payload_id, int) or not 1 <= payload_id <= 255:
            raise ValueError("module id must be a number between 1 and 255")
        if not self.online:
            raise ValueError("the split-flap master is offline")
        master_state = str(self.status.master_ota.get("state") or "idle")
        if master_state in MASTER_OTA_STATES_ACTIVE:
            raise ValueError(
                f"a master firmware session is already running ({master_state})"
            )
        if not image:
            raise ValueError("the firmware image is empty")
        if len(image) > OTA_APP_MAX_SIZE:
            raise ValueError(
                f"the firmware image is {len(image)} bytes, larger than the "
                f"{OTA_APP_MAX_SIZE}-byte application region"
            )
        state = self.status.ota.get("state")
        if state in OTA_STATES_ACTIVE:
            raise ValueError(f"an OTA session is already running ({state})")
        # A module stuck in its bootloader no longer answers the ASCII scan,
        # so a missing module entry must not block the recovery flash.

        await self.async_firmware_begin(payload_id)
        for offset in range(0, len(image), OTA_CHUNK_BYTES):
            await self.async_firmware_chunk(image[offset : offset + OTA_CHUNK_BYTES])
        await self.async_firmware_flash()

        return {
            "ok": True,
            "module": payload_id,
            "size": len(image),
            "chunks": (len(image) + OTA_CHUNK_BYTES - 1) // OTA_CHUNK_BYTES,
            "crc32": f"{zlib.crc32(image) & 0xFFFFFFFF:08X}",
        }

    # ------------------------------------------------------------------
    # Master self-update (MQTT, independent of the slave RS485 chain)
    # ------------------------------------------------------------------

    def _assert_firmware_slot_free(self) -> None:
        """Only one firmware operation may own the master at a time."""

        if not self.online:
            raise ValueError("the split-flap master is offline")
        slave_state = str(self.status.ota.get("state") or "idle")
        if slave_state in OTA_STATES_ACTIVE:
            raise ValueError(f"a module OTA session is already running ({slave_state})")
        master_state = str(self.status.master_ota.get("state") or "idle")
        if master_state in MASTER_OTA_STATES_ACTIVE:
            raise ValueError(
                f"a master firmware session is already running ({master_state})"
            )

    async def async_master_firmware_begin(
        self, *, version: str, sha256: str, size: int
    ) -> None:
        """Start a master self-update collection."""

        await self._publish(
            "master_firmware",
            {
                "action": "begin",
                "version": str(version or ""),
                "sha256": str(sha256),
                "size": int(size),
            },
        )

    async def async_master_firmware_chunk(self, data: bytes | str) -> None:
        """Append one base64 image slice to the master's staging file."""

        encoded = data if isinstance(data, str) else base64.b64encode(data).decode("ascii")
        await self._publish("master_firmware", {"action": "chunk", "data": encoded})

    async def async_master_firmware_flash(self) -> None:
        """Apply the staged image; the master reboots automatically."""

        await self._publish("master_firmware", {"action": "flash"})

    async def async_master_firmware_cancel(self) -> None:
        """Discard a staged image; ignored once the flash has started."""

        await self._publish("master_firmware", {"action": "cancel"})

    async def async_flash_master_image(
        self,
        image: bytes,
        *,
        version: str | None = None,
        sha256: str | None = None,
    ) -> dict[str, Any]:
        """Ship an app-only ESP32 image and start the master self-update.

        ``sha256`` is checked against the local image before publishing so a
        corrupt download never reaches the master. Success here only means the
        commands were sent; callers confirm the new version after reboot.
        """

        if not image:
            raise ValueError("the firmware image is empty")
        if len(image) > MASTER_OTA_MAX_SIZE:
            raise ValueError(
                f"the firmware image is {len(image)} bytes, larger than the "
                f"{MASTER_OTA_MAX_SIZE}-byte master application limit"
            )
        digest = hashlib.sha256(image).hexdigest()
        if sha256 and str(sha256).lower() != digest:
            raise ValueError("master_firmware_checksum_mismatch")
        self._assert_firmware_slot_free()

        await self.async_master_firmware_begin(
            version=version or "", sha256=digest, size=len(image)
        )
        for offset in range(0, len(image), MASTER_OTA_CHUNK_BYTES):
            await self.async_master_firmware_chunk(
                image[offset : offset + MASTER_OTA_CHUNK_BYTES]
            )
            # QoS 0 cannot signal congestion: pace the stream so the master can
            # finish its blocking slot write before the broker sends the next.
            await asyncio.sleep(MASTER_OTA_CHUNK_PAUSE_SECONDS)
        await self.async_master_firmware_flash()

        return {
            "ok": True,
            "size": len(image),
            "chunks": (
                (len(image) + MASTER_OTA_CHUNK_BYTES - 1) // MASTER_OTA_CHUNK_BYTES
            ),
            "sha256": digest,
            "version": version or None,
        }

    async def _wait_for_drum(
        self, module_id: Any, drum: str, timeout: float = 10.0
    ) -> dict[str, Any]:
        """Wait until the module reports ``drum`` and return the outcome.

        The status updates arrive through the MQTT subscription while this
        coroutine sleeps, so polling ``self.modules`` is enough.
        """

        key = str(module_payload_id(module_id))
        expected = list(drum)
        reported: Any = None
        for _ in range(max(1, int(timeout / 0.5))):
            module = self.modules.get(key) or {}
            reported = module.get("flap_list")
            if isinstance(reported, list) and reported == expected:
                return {"ok": True, "verified": True}
            await asyncio.sleep(0.5)
        return {
            "ok": True,
            "verified": False,
            "reported": "".join(reported)
            if isinstance(reported, list)
            else None,
        }

    async def async_home_all(self) -> None:
        for module_id in self.module_ids:
            await self.async_calibrate(module_id=module_id, action="home")
            await asyncio.sleep(0.05)

    async def async_record_all(self, index: int) -> None:
        for module_id in self.module_ids:
            await self.async_calibrate(module_id=module_id, action="record", index=index)
            await asyncio.sleep(0.05)
