"""Generate Starlight markdown reference pages for the Nhost Python SDK.

This is the Python analogue of the TypeDoc (``nhost-js``) and rustdoc
(``nhost-rust``) reference generators: it imports the installed ``nhost`` package
and introspects it with the standard library (``inspect``) to emit one markdown
page per public module (``main``, ``auth``, ``storage``, ``graphql``,
``functions``, ``session``, ``fetch``), grouping each module's public classes,
functions, and type aliases with rendered signatures and docstrings.

Run it against an environment where ``nhost`` is importable, e.g. from the SDK
package directory:

    uv run python ../../docs/pydoc-to-md.py <output-dir>

Kept dependency-free (stdlib only) so it runs under the SDK's own venv without
pulling extra doc tooling into the build.
"""

from __future__ import annotations

import ast
import dataclasses
import importlib
import inspect
import re
import sys
import types
import typing
from pathlib import Path
from types import ModuleType

PAGES = [
    ("nhost.nhost", "Main", "main"),
    ("nhost.auth", "Auth", "auth"),
    ("nhost.storage", "Storage", "storage"),
    ("nhost.graphql", "Graphql", "graphql"),
    ("nhost.functions", "Functions", "functions"),
    ("nhost.session", "Session", "session"),
    ("nhost.fetch", "Fetch", "fetch"),
]

_RST_ROLE = re.compile(r":(?:class|func|meth|mod|exc|attr):`([^`]+)`")


class _RawAnnotation(str):
    def __repr__(self) -> str:
        return str(self)


class _OmittedDefault:
    def __repr__(self) -> str:
        return "..."


_OMITTED_DEFAULT = _OmittedDefault()


def is_public(name: str) -> bool:
    return not name.startswith("_")


def defined_here(obj: object, prefix: str) -> bool:
    """Return whether ``obj`` is defined in this module or subpackage."""
    mod = getattr(obj, "__module__", "") or ""
    return mod == prefix or mod.startswith(prefix + ".")


def _normalize_annotation_text(text: str, module_name: str | None) -> str:
    if module_name and (module := sys.modules.get(module_name)):
        for alias, value in vars(module).items():
            if isinstance(value, ModuleType):
                text = re.sub(
                    rf"\b{re.escape(alias)}\.",
                    f"{value.__name__}.",
                    text,
                )
    return text.replace("collections.abc.", "").replace("typing.", "")


def _type_name(value: object) -> str:
    module = getattr(value, "__module__", "")
    name = getattr(value, "__qualname__", getattr(value, "__name__", str(value)))
    if module in {"", "builtins", "collections.abc", "typing"}:
        return name
    return f"{module}.{name}"


def _fmt_annotation(value: object, module_name: str | None = None) -> str:
    if isinstance(value, str):
        return _normalize_annotation_text(value, module_name)
    if isinstance(value, typing.ForwardRef):
        return _normalize_annotation_text(value.__forward_arg__, module_name)
    if value is None or value is type(None):
        return "None"
    if value is Ellipsis:
        return "..."

    alias_type = getattr(typing, "TypeAliasType", None)
    if alias_type is not None and isinstance(value, alias_type):
        return _fmt_annotation(value.__value__, module_name)
    if hasattr(value, "__supertype__"):
        return _fmt_annotation(value.__supertype__, module_name)

    origin = typing.get_origin(value)
    args = typing.get_args(value)
    if origin in {typing.Union, types.UnionType}:
        return " | ".join(_fmt_annotation(arg, module_name) for arg in args)
    if origin is typing.Literal:
        return f"Literal[{', '.join(repr(arg) for arg in args)}]"
    if (
        origin in {typing.Callable, typing.get_origin(typing.Callable)}
        and len(args) == 2
    ):
        parameters, result = args
        if parameters is Ellipsis:
            rendered_parameters = "..."
        else:
            rendered_parameters = ", ".join(
                _fmt_annotation(parameter, module_name) for parameter in parameters
            )
        return (
            f"Callable[[{rendered_parameters}], {_fmt_annotation(result, module_name)}]"
        )
    if origin is not None:
        rendered_origin = _type_name(origin)
        rendered_args = ", ".join(_fmt_annotation(arg, module_name) for arg in args)
        return f"{rendered_origin}[{rendered_args}]"
    if inspect.isclass(value):
        return _type_name(value)
    return _normalize_annotation_text(str(value), module_name)


def annotations_of(cls: type) -> dict[str, str]:
    """Return public annotations declared by SDK classes in the MRO."""
    out: dict[str, str] = {}
    for klass in reversed(cls.__mro__):
        if not getattr(klass, "__module__", "").startswith("nhost."):
            continue
        # Python 3.14's deferred annotations may expose ``__annotate__`` rather
        # than ``__annotations__`` (notably for ``NamedTuple`` subclasses).
        raw = inspect.get_annotations(klass, eval_str=False)
        for key, value in raw.items():
            if is_public(key) and not key.startswith("model_"):
                out[key] = _fmt_annotation(value, klass.__module__)
    return out


def _md_cell(text: str) -> str:
    return text.replace("|", "\\|")


def _annotation_for_signature(annotation: object, module_name: str | None) -> object:
    if annotation is inspect.Signature.empty:
        return annotation
    return _RawAnnotation(_fmt_annotation(annotation, module_name))


def render_signature(
    name: str,
    obj: object,
    *,
    drop_first_parameter: bool = False,
) -> str:
    try:
        signature = inspect.signature(obj)
    except (ValueError, TypeError):
        return f"{name}(...)"

    parameters = list(signature.parameters.values())
    if drop_first_parameter and parameters:
        parameters = parameters[1:]
    parameters = [
        parameter.replace(
            annotation=_annotation_for_signature(
                parameter.annotation,
                getattr(obj, "__module__", None),
            ),
            default=(
                _OMITTED_DEFAULT
                if parameter.default is not inspect.Signature.empty
                and repr(parameter.default).startswith("_")
                else parameter.default
            ),
        )
        for parameter in parameters
    ]
    signature = signature.replace(
        parameters=parameters,
        return_annotation=_annotation_for_signature(
            signature.return_annotation,
            getattr(obj, "__module__", None),
        ),
    )
    prefix = "async def " if inspect.iscoroutinefunction(obj) else "def "
    return prefix + f"{name}{signature}"


def _role_text(match: re.Match[str]) -> str:
    target = match.group(1)
    if " <" in target and target.endswith(">"):
        target = target.split(" <", 1)[0]
    elif target.startswith("~"):
        target = target[1:].rsplit(".", 1)[-1]
    return f"`{target}`"


def _escape_angles_outside_code(line: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(line):
        if line[index] != "`":
            out.append({"<": "&lt;", ">": "&gt;"}.get(line[index], line[index]))
            index += 1
            continue

        end_delimiter = index
        while end_delimiter < len(line) and line[end_delimiter] == "`":
            end_delimiter += 1
        delimiter = line[index:end_delimiter]
        closing = line.find(delimiter, end_delimiter)
        if closing == -1:
            out.append(delimiter)
            index = end_delimiter
            continue
        out.append(line[index : closing + len(delimiter)])
        index = closing + len(delimiter)
    return "".join(out)


def _normalize_doc(doc: str) -> str:
    lines: list[str] = []
    in_fence = False
    for line in _fence_doctests(doc).split("\n"):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            lines.append(line)
        elif in_fence:
            lines.append(line)
        else:
            lines.append(_escape_angles_outside_code(_RST_ROLE.sub(_role_text, line)))
    return "\n".join(lines)


def clean_doc(obj: object) -> str:
    return _normalize_doc(inspect.getdoc(obj) or "")


def own_doc(cls: type) -> str:
    """Return the docstring defined directly on ``cls``, not an inherited one."""
    raw = cls.__dict__.get("__doc__")
    if not raw:
        return ""
    return _normalize_doc(inspect.cleandoc(raw))


def _fence_doctests(doc: str) -> str:
    """Wrap ``>>>`` doctest regions in Python fences."""
    lines = doc.split("\n")
    out: list[str] = []
    index = 0
    while index < len(lines):
        if lines[index].lstrip().startswith(">>>"):
            block: list[str] = []
            while index < len(lines) and lines[index].strip() != "":
                block.append(lines[index])
                index += 1
            out.append("```python")
            out.extend(block)
            out.append("```")
        else:
            out.append(lines[index])
            index += 1
    return "\n".join(out)


def is_pydantic_model(cls: type) -> bool:
    return any(base.__name__ == "BaseModel" for base in cls.__mro__)


def heading(depth: int, text: str) -> str:
    return "#" * depth + " " + text


def render_function(name: str, obj: object) -> str:
    parts = [
        heading(3, f"`{name}`"),
        "```python\n" + render_signature(name, obj) + "\n```",
    ]
    doc = clean_doc(obj)
    if doc:
        parts.append(doc)
    return "\n\n".join(parts)


def _member_owner(cls: type, name: str) -> type | None:
    return next((base for base in cls.__mro__ if name in base.__dict__), None)


def public_methods(cls: type) -> list[tuple[str, object]]:
    methods: list[tuple[str, object]] = []
    for name, member in inspect.getmembers(cls):
        if not is_public(name) or name.startswith("model_"):
            continue
        if not (inspect.isfunction(member) or inspect.ismethod(member)):
            continue
        owner = _member_owner(cls, name)
        if owner is None or not owner.__module__.startswith("nhost."):
            continue
        methods.append((name, member))
    return methods


def public_properties(cls: type) -> list[tuple[str, property]]:
    properties: list[tuple[str, property]] = []
    for name, member in inspect.getmembers(cls):
        if not is_public(name) or not isinstance(member, property):
            continue
        owner = _member_owner(cls, name)
        if owner is None or not owner.__module__.startswith("nhost."):
            continue
        properties.append((name, member))
    return properties


def _class_name(cls: type) -> str:
    return getattr(cls, "__name__", str(cls).replace("typing.", ""))


def _method_decorators(cls: type, name: str) -> list[str]:
    descriptor = inspect.getattr_static(cls, name)
    if isinstance(descriptor, classmethod):
        return ["@classmethod"]
    if isinstance(descriptor, staticmethod):
        return ["@staticmethod"]
    return []


def render_class(name: str, cls: type, documented_classes: set[type]) -> str:
    bases = [base for base in cls.__bases__ if base is not object]
    suffix = f"({', '.join(_class_name(base) for base in bases)})" if bases else ""
    declaration = f"class {name}{suffix}:"

    if (
        not is_pydantic_model(cls)
        and not dataclasses.is_dataclass(cls)
        and "__init__" in cls.__dict__
    ):
        constructor = render_signature(
            "__init__",
            cls.__dict__["__init__"],
            drop_first_parameter=True,
        )
        declaration += "\n    " + constructor

    parts = [heading(3, f"`{name}`"), "```python\n" + declaration + "\n```"]
    linked_bases = [base for base in bases if base in documented_classes]
    if linked_bases:
        links = ", ".join(
            f"[`{_class_name(base)}`](#{_class_name(base).lower().replace('_', '-')})"
            for base in linked_bases
        )
        parts.append(f"Extends {links}.")

    doc = own_doc(cls)
    if doc:
        parts.append(doc)

    fields = annotations_of(cls)
    if fields:
        rows = ["| Field | Type |", "| --- | --- |"]
        rows += [
            f"| `{_md_cell(field)}` | `{_md_cell(type_)}` |"
            for field, type_ in fields.items()
        ]
        parts.append(heading(4, "Fields"))
        parts.append("\n".join(rows))

    properties = public_properties(cls)
    if properties:
        parts.append(heading(4, "Properties"))
        for property_name, prop in properties:
            getter = prop.fget
            if getter is None:
                continue
            sub = [
                heading(5, f"`{property_name}`"),
                "```python\n@property\n"
                + render_signature(property_name, getter)
                + "\n```",
            ]
            property_doc = clean_doc(getter)
            if property_doc:
                sub.append(property_doc)
            parts.append("\n\n".join(sub))

    methods = public_methods(cls)
    if methods:
        parts.append(heading(4, "Methods"))
        for method_name, method in methods:
            rendered = _method_decorators(cls, method_name) + [
                render_signature(method_name, method)
            ]
            sub = [
                heading(5, f"`{method_name}`"),
                "```python\n" + "\n".join(rendered) + "\n```",
            ]
            method_doc = clean_doc(method)
            if method_doc:
                sub.append(method_doc)
            parts.append("\n\n".join(sub))
    return "\n\n".join(parts)


def _declared_names(module: object) -> set[str]:
    exported = getattr(module, "__all__", None)
    if exported is not None:
        return set(exported)
    try:
        tree = ast.parse(inspect.getsource(module))
    except (OSError, TypeError, SyntaxError):
        return set(vars(module))

    names: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names.add(node.target.id)
    return names


def _is_type_alias(value: object) -> bool:
    if typing.get_origin(value) is not None:
        return True
    alias_type = getattr(typing, "TypeAliasType", None)
    return bool(
        (alias_type is not None and isinstance(value, alias_type))
        or hasattr(value, "__supertype__")
    )


def collect(module: object, prefix: str) -> tuple[list, list, list]:
    functions: list[tuple[str, object]] = []
    aliases: list[tuple[str, object]] = []
    classes: list[tuple[str, type]] = []
    declared_names = _declared_names(module)
    seen: set[str] = set()
    for name in sorted(dir(module)):
        if not is_public(name) or name in seen:
            continue
        obj = getattr(module, name)
        if inspect.isclass(obj) and defined_here(obj, prefix):
            classes.append((name, obj))
            seen.add(name)
        elif inspect.isfunction(obj) and defined_here(obj, prefix):
            functions.append((name, obj))
            seen.add(name)
        elif name in declared_names and _is_type_alias(obj):
            aliases.append((name, obj))
            seen.add(name)
    return functions, aliases, classes


def render_alias(name: str, value: object, module_name: str) -> str:
    return "\n\n".join(
        [
            heading(3, f"`{name}`"),
            f"```python\n{name} = {_fmt_annotation(value, module_name)}\n```",
        ]
    )


def render_page(title: str, module: object, prefix: str) -> str:
    functions, aliases, classes = collect(module, prefix)
    out = [f"---\ntitle: {title}\n---"]
    module_doc = clean_doc(module)
    if module_doc:
        out.append(module_doc)
    if functions:
        out.append(heading(2, "Functions"))
        out += [render_function(name, obj) for name, obj in functions]
    if aliases:
        out.append(heading(2, "Type aliases"))
        out += [render_alias(name, value, prefix) for name, value in aliases]
    if classes:
        out.append(heading(2, "Classes"))
        documented_classes = {cls for _, cls in classes}
        out += [render_class(name, cls, documented_classes) for name, cls in classes]
    return "\n\n".join(out) + "\n"


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: pydoc-to-md.py <output-dir>", file=sys.stderr)
        raise SystemExit(1)
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)

    for import_path, title, file_name in PAGES:
        module = importlib.import_module(import_path)
        markdown = render_page(title, module, import_path)
        destination = out_dir / f"{file_name}.md"
        destination.write_text(markdown)
        print(f"wrote {destination}")


if __name__ == "__main__":
    main()
