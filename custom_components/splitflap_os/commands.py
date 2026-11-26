"""Command semantics shared by the panel and automation adapters.

Home Assistant free on purpose: both adapters inject the runtime and the user
identity, so the whole command interface is testable under plain Python.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping

try:  # package import (Home Assistant)
    from .firmware import image_from_hex
    from .firmware_releases import FirmwareReleaseError, check_compatibility
    from .ota import OTA_PROTOCOL_VERSION
    from .positions import normalize_position_map
except ImportError:  # direct import in the host tests (component dir on sys.path)
    from firmware import image_from_hex
    from firmware_releases import FirmwareReleaseError, check_compatibility
    from ota import OTA_PROTOCOL_VERSION
    from positions import normalize_position_map

INVALID_REQUEST = "invalid_request"
COMMAND_FAILED = "command_failed"

_MISSING = object()

Runner = Callable[[dict[str, Any], Mapping[str, Any]], Awaitable[Any]]


@dataclass(frozen=True)
class CommandOutcome:
    """One result shape for every command."""

    result: Any = None
    error: str | None = None
    message: str = ""
    exception: BaseException | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


@dataclass(frozen=True)
class Field:
    """One field of a command's interface, including defaults and coercion."""

    name: str
    kind: str = "str"
    default: Any = _MISSING

    @property
    def required(self) -> bool:
        return self.default is _MISSING


@dataclass(frozen=True)
class Command:
    """A command's fields and the implementation behind its seam."""

    fields: tuple[Field, ...]
    run: Runner


def _coerce(value: Any, field: Field) -> Any:
    if value is None:
        return None

    kind = field.kind
    if kind == "str":
        if not isinstance(value, str):
            raise ValueError(f"{field.name} must be a string")
        return value
    if kind == "dict":
        if not isinstance(value, dict):
            raise ValueError(f"{field.name} must be a mapping")
        return value
    if kind == "bool":
        if not isinstance(value, bool):
            raise ValueError(f"{field.name} must be a boolean")
        return value
    if kind in ("int", "float"):
        caster = int if kind == "int" else float
        try:
            return caster(value)
        except (TypeError, ValueError) as err:
            raise ValueError(f"{field.name} must be a {kind}") from err
    if kind == "module":
        if not isinstance(value, (int, str)):
            raise ValueError(f"{field.name} must be a module id")
        return value
    if kind == "pages":
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as err:
                raise ValueError("pages must be a JSON array") from err
            if isinstance(parsed, list):
                return parsed
        raise ValueError("pages must be a JSON array")
    if kind == "positions":
        if isinstance(value, str):
            return normalize_position_map(value)
        if isinstance(value, dict):
            return value
        return None
    raise ValueError(f"unsupported field kind: {kind}")


def _arguments(fields: tuple[Field, ...], data: Mapping[str, Any]) -> dict[str, Any]:
    args: dict[str, Any] = {}
    for field in fields:
        if field.name in data:
            value = data[field.name]
        elif field.required:
            raise ValueError(f"missing required field: {field.name}")
        else:
            value = field.default
        args[field.name] = _coerce(value, field)
    return args


def _call(target: str, method: str, *names: str) -> Runner:
    async def run(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
        target_module = runtime[target]
        return await getattr(target_module, method)(*(args[name] for name in names))

    return run


async def _send_text(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["engine"].async_send_text(
        args["text"],
        start=args["start"],
        style=args["style"],
        speed=args["speed"],
        stop=args["stop"],
        raw=args["raw"],
    )


async def _notify(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["engine"].async_notify(
        args["text"],
        seconds=args["seconds"],
        style=args["style"],
        priority=args["priority"],
    )


async def _play_playlist(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["engine"].async_play_playlist(
        args["pages"], args["delay"], loop=args["loop"]
    )


async def _start_app(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["engine"].async_start_app(
        args["app"], args.get("mode"), user_id=args.get("user_id")
    )


async def _save_playlist(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["engine"].async_save_playlist(
        args["name"], args["pages"], args["delay"]
    )


async def _calibrate(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    return await runtime["coordinator"].async_calibrate(
        module_id=args["module"],
        action=args["action"],
        index=args.get("index"),
        flap=args.get("flap"),
        home_offset=args.get("home_offset"),
        positions=args.get("positions"),
        clear_map=args.get("clear_map", False),
        steps=args.get("steps"),
        drum=args.get("drum"),
    )


async def _flash_firmware(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
    image = image_from_hex(args["hex"])
    return await runtime["coordinator"].async_flash_image(args["module"], image)


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _release_catalog(runtime: Mapping[str, Any]) -> Any:
    catalog = runtime.get("release_catalog")
    if catalog is None:
        raise FirmwareReleaseError("firmware_release_unavailable")
    return catalog


def _allow_incompatible(runtime: Mapping[str, Any]) -> bool:
    engine = runtime.get("engine")
    if engine is None:
        return False
    return _as_bool(
        engine.settings.get("debug_allow_incompatible_firmware", False)
    )


async def _list_firmware_releases(
    args: dict[str, Any], runtime: Mapping[str, Any]
) -> Any:
    coordinator = runtime["coordinator"]
    return await _release_catalog(runtime).list(
        refresh=args["refresh"],
        master_bus_compat=coordinator.master_bus_compat,
        allow_incompatible=_allow_incompatible(runtime),
    )


async def _flash_firmware_release(
    args: dict[str, Any], runtime: Mapping[str, Any]
) -> Any:
    coordinator = runtime["coordinator"]
    catalog = _release_catalog(runtime)
    allow_incompatible = _allow_incompatible(runtime)

    # Always re-read the manifest: the rolling dev asset can change between
    # opening the panel and pressing Flash.
    release = await catalog.get(args["release"], refresh=True)
    ota = coordinator.snapshot().get("ota") or {}
    bootloader_version = (
        ota.get("bootloader_version")
        if ota.get("module") == args["module"]
        else None
    )
    module = coordinator.module_snapshot(str(args["module"]))
    compatibility = check_compatibility(
        release,
        master_bus_compat=coordinator.master_bus_compat,
        module_bus_compatible=module.get("fw_bus_compatible"),
        module_bootloader_version=bootloader_version,
        allow_incompatible=allow_incompatible,
        ota_protocol_version=OTA_PROTOCOL_VERSION,
    )
    if compatibility.blocked:
        raise FirmwareReleaseError(compatibility.codes[0])

    image = await catalog.fetch_image(release)
    result = await coordinator.async_flash_image(args["module"], image)
    return {
        **result,
        "release": release.as_dict(),
        "compatibility": compatibility.as_dict(),
    }


COMMANDS: dict[str, Command] = {
    "send_text": Command(
        (
            Field("text", "str"),
            Field("start", "int", 1),
            Field("style", "str", "ltr"),
            Field("speed", "int", 15),
            Field("stop", "bool", True),
            Field("raw", "bool", False),
        ),
        _send_text,
    ),
    "notify": Command(
        (
            Field("text", "str"),
            Field("seconds", "float", 10),
            Field("style", "str", "ltr"),
            Field("priority", "int", 0),
        ),
        _notify,
    ),
    "play_playlist": Command(
        (
            Field("pages", "pages"),
            Field("delay", "float", 5),
            Field("loop", "bool", True),
        ),
        _play_playlist,
    ),
    "start_app": Command((Field("app", "str"), Field("mode", "str", None)), _start_app),
    "stop_app": Command((), _call("engine", "async_stop")),
    "set_settings": Command(
        (Field("settings", "dict"),),
        _call("engine", "async_set_settings", "settings"),
    ),
    "save_playlist": Command(
        (
            Field("name", "str"),
            Field("pages", "pages"),
            Field("delay", "float", 5),
        ),
        _save_playlist,
    ),
    "delete_playlist": Command(
        (Field("name", "str"),),
        _call("engine", "async_delete_playlist", "name"),
    ),
    "run_saved_playlist": Command(
        (Field("name", "str"),),
        _call("engine", "async_run_saved_playlist", "name"),
    ),
    "save_drum": Command(
        (Field("name", "str"), Field("drum", "str")),
        _call("engine", "async_save_drum", "name", "drum"),
    ),
    "delete_drum": Command(
        (Field("name", "str"),),
        _call("engine", "async_delete_drum", "name"),
    ),
    "calibrate": Command(
        (
            Field("module", "module"),
            Field("action", "str"),
            Field("index", "int", None),
            Field("flap", "str", None),
            Field("home_offset", "int", None),
            Field("positions", "positions", None),
            Field("clear_map", "bool", False),
            Field("steps", "int", None),
            Field("drum", "str", None),
        ),
        _calibrate,
    ),
    "scan": Command((), _call("coordinator", "async_scan")),
    "sync": Command((), _call("coordinator", "async_sync")),
    "update": Command((), _call("coordinator", "async_update")),
    "home_all": Command((), _call("coordinator", "async_home_all")),
    "record_all": Command(
        (Field("index", "int"),),
        _call("coordinator", "async_record_all", "index"),
    ),
    "backup": Command((), _call("engine", "async_backup")),
    "restore": Command(
        (Field("data", "dict"),),
        _call("engine", "async_restore", "data"),
    ),
    "flash_firmware": Command(
        (Field("module", "int"), Field("hex", "str")),
        _flash_firmware,
    ),
    "list_firmware_releases": Command(
        (Field("refresh", "bool", False),),
        _list_firmware_releases,
    ),
    "flash_firmware_release": Command(
        (Field("release", "str"), Field("module", "int")),
        _flash_firmware_release,
    ),
    "cancel_firmware": Command((), _call("coordinator", "async_firmware_cancel")),
    "reset_firmware": Command(
        (Field("module", "int"),),
        _call("coordinator", "async_firmware_reset", "module"),
    ),
}


async def execute_command(
    name: str,
    data: Mapping[str, Any],
    runtime: Mapping[str, Any],
    *,
    user_id: str | None = None,
) -> CommandOutcome:
    """Run one command through the shared interface."""

    command = COMMANDS.get(name)
    if command is None:
        err = ValueError(f"unknown command: {name}")
        return CommandOutcome(error=INVALID_REQUEST, message=str(err), exception=err)

    try:
        args = _arguments(command.fields, data)
    except ValueError as err:
        return CommandOutcome(error=INVALID_REQUEST, message=str(err), exception=err)

    args["user_id"] = user_id
    try:
        result = await command.run(args, runtime)
    except ValueError as err:
        return CommandOutcome(error=INVALID_REQUEST, message=str(err), exception=err)
    except Exception as err:  # noqa: BLE001 - one error mode for every caller
        return CommandOutcome(error=COMMAND_FAILED, message=str(err), exception=err)
    return CommandOutcome(result=result)
