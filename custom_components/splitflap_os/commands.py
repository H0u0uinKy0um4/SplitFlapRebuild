"""Command semantics shared by the panel and automation adapters.

Home Assistant free on purpose: both adapters inject the runtime and the user
identity, so the whole command interface is testable under plain Python.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping

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
    kind: str = "str"  # str | int | float | dict
    default: Any = _MISSING

    @property
    def required(self) -> bool:
        return self.default is _MISSING


@dataclass(frozen=True)
class Command:
    """A command's fields and the implementation behind its seam."""

    fields: tuple[Field, ...]
    run: Runner


def _coerce(value: Any, kind: str, name: str) -> Any:
    if kind == "str":
        if not isinstance(value, str):
            raise ValueError(f"{name} must be a string")
        return value
    if kind == "dict":
        if not isinstance(value, dict):
            raise ValueError(f"{name} must be a mapping")
        return value
    if kind in ("int", "float"):
        caster = int if kind == "int" else float
        try:
            return caster(value)
        except (TypeError, ValueError) as err:
            raise ValueError(f"{name} must be a {kind}") from err
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
        args[field.name] = _coerce(value, field.kind, field.name)
    return args


def _call(target: str, method: str, *names: str) -> Runner:
    async def run(args: dict[str, Any], runtime: Mapping[str, Any]) -> Any:
        target_module = runtime[target]
        return await getattr(target_module, method)(*(args[name] for name in names))

    return run


# First increment: the shared commands whose semantics already match in both
# adapters. Divergent and panel-only commands stay in their adapters for now.
COMMANDS: dict[str, Command] = {
    "stop_app": Command((), _call("engine", "async_stop")),
    "set_settings": Command(
        (Field("settings", "dict"),),
        _call("engine", "async_set_settings", "settings"),
    ),
    "delete_playlist": Command(
        (Field("name", "str"),),
        _call("engine", "async_delete_playlist", "name"),
    ),
    "run_saved_playlist": Command(
        (Field("name", "str"),),
        _call("engine", "async_run_saved_playlist", "name"),
    ),
    "scan": Command((), _call("coordinator", "async_scan")),
    "sync": Command((), _call("coordinator", "async_sync")),
    "update": Command((), _call("coordinator", "async_update")),
    "home_all": Command((), _call("coordinator", "async_home_all")),
    "record_all": Command(
        (Field("index", "int"),),
        _call("coordinator", "async_record_all", "index"),
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
