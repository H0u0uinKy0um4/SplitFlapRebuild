"""Normalize master status into panel-ready module snapshots.

One deep module behind a small interface: callers hand it raw MQTT payloads or
persisted state and read ``snapshot()``. Alias resolution, flap derivation,
drum priority and OTA status all stay inside. There are no Home Assistant,
websocket or Store imports on purpose, so the whole normalization path is
drivable under plain Python.
"""

from __future__ import annotations

import re
from typing import Any, Callable

try:  # package import (Home Assistant)
    from .layout import DEFAULT_DRUM
    from .master_ota import empty_master_ota, normalize_master_ota
    from .ota import OTA_STATE_IDLE, normalize_ota
    from .positions import normalize_position_map
except ImportError:  # direct import in the host tests (component dir on sys.path)
    from layout import DEFAULT_DRUM
    from master_ota import empty_master_ota, normalize_master_ota
    from ota import OTA_STATE_IDLE, normalize_ota
    from positions import normalize_position_map

_NUMERIC_ID = re.compile(r"^\d+$")


def module_sort_key(module_id: Any) -> tuple[int, int | str]:
    value = str(module_id).strip()
    if _NUMERIC_ID.match(value):
        return (0, int(value))
    return (1, value.casefold())


def module_payload_id(module_id: Any) -> int | str:
    value = str(module_id).strip()
    if _NUMERIC_ID.match(value):
        return int(value)
    return value


def coerce_count(value: Any, fallback: int = 0) -> int:
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return max(fallback, 0)


def coerce_optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"1", "true", "yes", "on", "enabled", "online"}:
            return True
        if text in {"0", "false", "no", "off", "disabled", "offline"}:
            return False
    return bool(value)


def coerce_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_flap_list(value: Any) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, str):
        return list(value)
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda item: module_sort_key(item[0]))
        return ["" if item is None else str(item) for _, item in items]
    if isinstance(value, (list, tuple)):
        return ["" if item is None else str(item) for item in value]
    return [str(value)]


def valid_drum(value: Any) -> bool:
    """A full 64-character drum with no line breaks.

    A short drum used to be space-padded, which shifted every flap index. A
    newline would also terminate the RS485 command that writes it.
    """

    return (
        isinstance(value, str)
        and len(value) == len(DEFAULT_DRUM)
        and "\r" not in value
        and "\n" not in value
    )


_MODULE_STAT_ALIASES: dict[str, tuple[str, ...]] = {
    "flap_list": (
        "flap_list", "flapList", "FlapList", "flaps", "drum", "drum_chars",
        "drumChars", "characters",
    ),
    "current_step": (
        "current_step", "currentStep", "CurrentStep", "current_step_pos",
        "currentStepPos", "step", "step_position", "position_step", "pos",
    ),
    "auto_homing": (
        "auto_homing", "autoHoming", "AutoHoming", "auto_home", "autoHome",
        "autoHomeEnabled", "autohome",
    ),
    "home_offset": (
        "home_offset", "homeOffset", "HomeOffset", "hall_offset", "hallOffset",
    ),
    "total_steps": (
        "total_steps", "totalSteps", "TotalSteps", "total_steps_per_rev",
        "totalStepsPerRev", "steps_per_rev", "stepsPerRev", "max_steps",
        "maxSteps",
    ),
    "current_index": (
        "current_index", "currentIndex", "CurrentIndex", "current_flap_index",
        "currentFlapIndex", "flap_index", "flapIndex", "index",
    ),
    "map_of_positions": (
        "map_of_positions", "mapOfPositions", "MapOfPositions", "position_map",
        "positionMap", "positions", "map",
    ),
    "busy": ("busy", "is_busy", "isBusy", "moving"),
    "position_known": (
        "position_known", "positionKnown", "PositionKnown", "position_valid",
        "positionValid",
    ),
    "online": ("online", "is_online", "isOnline", "connected"),
    "last_seen": ("last_seen", "lastSeen", "last_seen_ms", "lastSeenMs"),
    "fw_version": (
        "fw_version", "fwVersion", "firmware_version", "firmwareVersion",
        "app_version", "appVersion",
    ),
}

_MODULE_STAT_CONTAINERS = ("stats", "config", "details", "module_stats")
_MODULE_STATE_KEYS = ("state", "module_state", "status")


def _module_sources(module: dict[str, Any]) -> list[dict[str, Any]]:
    sources = [module]
    for key in _MODULE_STAT_CONTAINERS:
        nested = module.get(key)
        if isinstance(nested, dict):
            sources.append(nested)
    return sources


def _first_value(sources: list[dict[str, Any]], aliases: tuple[str, ...]) -> Any:
    for source in sources:
        for alias in aliases:
            if alias in source and source[alias] is not None:
                return source[alias]
    return None


def _module_state(module: dict[str, Any]) -> str:
    for key in _MODULE_STATE_KEYS:
        if key in module and module[key] is not None:
            value = module[key]
            return str(value) if value != "" else "unknown"
    return "unknown"


def _derive_flap_state(
    module: dict[str, Any], flap: Any
) -> tuple[int | None, int | None]:
    """The one flap-index/position derivation used everywhere."""

    flap_list = module.get("flap_list")
    if not isinstance(flap_list, list) or not flap_list or flap in (None, ""):
        return None, None
    try:
        index = flap_list.index(str(flap))
    except ValueError:
        return None, None

    positions = module.get("map_of_positions")
    position = positions.get(str(index)) if isinstance(positions, dict) else None
    if position is None:
        total_steps = module.get("total_steps")
        if isinstance(total_steps, int) and total_steps > 0:
            home_offset = module.get("home_offset", 0)
            if not isinstance(home_offset, int):
                home_offset = 0
            position = (home_offset + (index * total_steps + 32) // 64) % total_steps
    return index, position if isinstance(position, int) else None


def _module_stats(module: dict[str, Any]) -> dict[str, Any]:
    """Resolve firmware aliases into one canonical diagnostic dict."""

    sources = _module_sources(module)
    stats: dict[str, Any] = {}

    flap_list = normalize_flap_list(
        _first_value(sources, _MODULE_STAT_ALIASES["flap_list"])
    )
    if flap_list is not None:
        stats["flap_list"] = flap_list

    for key in ("current_step", "home_offset", "total_steps", "current_index"):
        value = coerce_optional_int(_first_value(sources, _MODULE_STAT_ALIASES[key]))
        if value is not None:
            stats[key] = value

    auto_homing = coerce_optional_bool(
        _first_value(sources, _MODULE_STAT_ALIASES["auto_homing"])
    )
    if auto_homing is not None:
        stats["auto_homing"] = auto_homing

    for key in ("busy", "position_known", "online"):
        value = coerce_optional_bool(
            _first_value(sources, _MODULE_STAT_ALIASES[key])
        )
        if value is not None:
            stats[key] = value

    last_seen = _first_value(sources, _MODULE_STAT_ALIASES["last_seen"])
    if last_seen is not None:
        stats["last_seen"] = last_seen

    fw_version = _first_value(sources, _MODULE_STAT_ALIASES["fw_version"])
    if isinstance(fw_version, str):
        fw_version = fw_version.strip()
        if fw_version:
            stats["fw_version"] = fw_version

    positions = normalize_position_map(
        _first_value(sources, _MODULE_STAT_ALIASES["map_of_positions"])
    )
    # Always expose a canonical dict: a raw string or sentinel-only map must
    # never leak into the panel, where it would look like tuned entries.
    stats["map_of_positions"] = positions or {}

    source = dict(module)
    source.update(stats)
    index, position = _derive_flap_state(source, module.get("flap"))
    if index is not None:
        stats["flap_index"] = index
    if position is not None:
        stats["flap_position"] = position

    known = {
        "id",
        "flap",
        "flap_index",
        "flap_position",
        "extra_stats",
        *_MODULE_STATE_KEYS,
        *_MODULE_STAT_CONTAINERS,
    }
    for aliases in _MODULE_STAT_ALIASES.values():
        known.update(aliases)
    extra: dict[str, Any] = {}
    for source in sources:
        for key, value in source.items():
            if key not in known and value is not None:
                extra[key] = value
    if extra:
        stats["extra_stats"] = extra

    return stats


def _normalize_modules(raw_modules: Any) -> dict[str, dict[str, Any]]:
    modules: dict[str, dict[str, Any]] = {}

    if isinstance(raw_modules, list):
        for item in raw_modules:
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            modules[str(item["id"])] = dict(item)
    elif isinstance(raw_modules, dict):
        for module_id, item in raw_modules.items():
            if isinstance(item, dict):
                module = dict(item)
            else:
                module = {"id": module_id, "flap": item}
            module.setdefault("id", module_id)
            modules[str(module_id)] = module

    for module in modules.values():
        module.update(_module_stats(module))
        if module.get("flap") is None:
            flap_list = module.get("flap_list")
            index = module.get("current_index")
            if (
                isinstance(flap_list, list)
                and isinstance(index, int)
                and 0 <= index < len(flap_list)
            ):
                module["flap"] = flap_list[index]

    return modules


class ModuleStatus:
    """Own normalized module state; ``snapshot()`` is the single read seam."""

    def __init__(
        self, *, drum_provider: Callable[[], str | None] | None = None
    ) -> None:
        self._drum_provider = drum_provider
        self._modules: dict[str, dict[str, Any]] = {}
        self._modules_count = 0
        self._ota: dict[str, Any] = {"state": OTA_STATE_IDLE}
        self._master_ota: dict[str, Any] = empty_master_ota()
        self._master_ip: str | None = None
        self._master_version: str | None = None
        self._master_bus_compat: int | None = None
        self._master_mqtt_compat: int | None = None
        #: Characters the integration has asked the display to show.
        self.desired_chars: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Views used by the coordinator, engine and entities
    # ------------------------------------------------------------------
    @property
    def modules(self) -> dict[str, dict[str, Any]]:
        return self._modules

    @property
    def module_ids(self) -> list[str]:
        return sorted(self._modules, key=module_sort_key)

    @property
    def modules_count(self) -> int:
        return self._modules_count or len(self._modules)

    @property
    def ota(self) -> dict[str, Any]:
        return self._ota

    @property
    def master_ota(self) -> dict[str, Any]:
        return self._master_ota

    @property
    def master_ip(self) -> str | None:
        """Last address reported for manual ArduinoOTA recovery."""

        return self._master_ip

    @property
    def master_version(self) -> str | None:
        return self._master_version

    @property
    def master_bus_compat(self) -> int | None:
        return self._master_bus_compat

    @property
    def master_mqtt_compat(self) -> int | None:
        return self._master_mqtt_compat

    def compat_ok(self, mqtt_compat: int) -> bool | None:
        """None means the master predates the version protocol."""

        if self._master_mqtt_compat is None:
            return None
        return self._master_mqtt_compat == mqtt_compat

    def flap_list_for(self, module_id: Any) -> list[str] | None:
        module = self._modules.get(str(module_id)) or {}
        flap_list = module.get("flap_list")
        if isinstance(flap_list, list) and flap_list:
            return flap_list
        return None

    def effective_drum(self, module_id: Any) -> list[str]:
        """Reported drum first, then the configured default, then stock."""

        reported = self.flap_list_for(module_id)
        if reported:
            return list(reported)
        if self._drum_provider is not None:
            default = self._drum_provider()
            if valid_drum(default):
                return list(default)
        return list(DEFAULT_DRUM)

    def module_snapshot(self, module_id: Any, *, master_online: bool) -> dict[str, Any]:
        key = str(module_id)
        module = dict(self._modules.get(key) or {})
        # Re-derive from a clean slate: a drum change can make an old index or
        # position underivable, and stale values must not survive the update.
        module.pop("flap_index", None)
        module.pop("flap_position", None)
        module.update(_module_stats(module))

        actual_flap = module.get("flap")
        desired_flap = self.desired_chars.get(key)
        displayed_flap = desired_flap if desired_flap is not None else actual_flap
        display_index, display_position = _derive_flap_state(module, displayed_flap)
        module.update(
            {
                "id": module_payload_id(key),
                "actual_flap": actual_flap,
                "desired_flap": desired_flap,
                "displayed_flap": displayed_flap,
                "display_flap_index": display_index,
                "display_flap_position": display_position,
                "effective_drum": self.effective_drum(key),
                "flap": actual_flap,
                "state": _module_state(module),
                "online": bool(module.get("online", True)) and master_online,
            }
        )
        return module

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------
    def ingest(self, payload: dict[str, Any], *, online: bool) -> None:
        """Fold one raw master status payload into the normalized state."""

        if online:
            version = payload.get("version")
            if isinstance(version, str) and version.strip():
                self._master_version = version.strip()
            bus_compat = coerce_optional_int(payload.get("bus_compat"))
            if bus_compat is not None:
                self._master_bus_compat = bus_compat
            # mqtt_compat is explicit on current masters; older ones only sent
            # "compat" as the single shared generation.
            compat = coerce_optional_int(payload.get("mqtt_compat"))
            if compat is None:
                compat = coerce_optional_int(payload.get("compat"))
            if compat is not None:
                self._master_mqtt_compat = compat
            ip = payload.get("ip")
            if isinstance(ip, str) and ip.strip():
                self._master_ip = ip.strip()

        raw_modules = payload.get("modules")
        if isinstance(raw_modules, (list, dict)):
            modules = _normalize_modules(raw_modules)
            reported_count = coerce_count(payload.get("modules_count"), len(modules))
            # An offline last-will payload carries no modules; keep the last
            # known snapshot so the panel and sensors survive a reboot.
            if online or not self._modules:
                self._modules = modules
                self._modules_count = len(modules) if modules else reported_count
        elif online and "modules_count" in payload:
            self._modules_count = coerce_count(
                payload.get("modules_count"), self._modules_count
            )

        # The offline last-will payload never carries OTA, so never trust one.
        if online and "ota" in payload:
            self._ota = normalize_ota(payload.get("ota"))
        if online and "master_ota" in payload:
            self._master_ota = normalize_master_ota(payload.get("master_ota"))

    def restore(self, stored: Any) -> bool:
        """Load persisted normalized state; return False when there is none."""

        if not isinstance(stored, dict):
            return False
        modules = _normalize_modules(stored.get("modules"))
        count = coerce_count(stored.get("modules_count"), len(modules))
        if not modules and not count:
            return False

        self._modules = modules
        self._modules_count = count or len(modules)
        desired = stored.get("desired_chars")
        if isinstance(desired, dict):
            self.desired_chars = {
                str(key): str(value) for key, value in desired.items()
            }
        return True

    def persisted(self) -> dict[str, Any]:
        return {
            "modules": dict(self._modules),
            "modules_count": self.modules_count,
            "desired_chars": dict(self.desired_chars),
        }

    # ------------------------------------------------------------------
    # One read seam
    # ------------------------------------------------------------------
    def snapshot(
        self,
        *,
        prefix: str,
        online: bool,
        status: str,
        text: str,
        last_status: Any,
        restored: bool,
        mqtt_compat: int,
    ) -> dict[str, Any]:
        compat_ok = self.compat_ok(mqtt_compat)
        return {
            "prefix": prefix,
            "online": online,
            "status": status,
            "text": text,
            "modules": [
                self.module_snapshot(module_id, master_online=online)
                for module_id in self.module_ids
            ],
            "modules_count": self.modules_count,
            "desired_chars": dict(self.desired_chars),
            "last_status": last_status,
            "restored": bool(restored),
            # mqtt_compat is this integration's generation; compat/compat_ok
            # remain aliases for older panel builds.
            "mqtt_compat": mqtt_compat,
            "master_version": self._master_version,
            "master_ip": self._master_ip,
            "master_bus_compat": self._master_bus_compat,
            "master_mqtt_compat": self._master_mqtt_compat,
            "mqtt_compat_ok": compat_ok,
            "compat": mqtt_compat,
            "master_compat": self._master_mqtt_compat,
            "compat_ok": compat_ok,
            "ota": dict(self._ota) or {"state": OTA_STATE_IDLE},
            "master_ota": dict(self._master_ota),
        }
