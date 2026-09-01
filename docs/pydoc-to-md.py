#!/usr/bin/env python3
"""Generate Starlight markdown reference pages for the Nhost Python SDK.

This is the Python analogue of the TypeDoc (`nhost-js`) and rustdoc
(`nhost-rust`) reference generators: it imports the installed ``nhost`` package
and introspects it with the standard library (``inspect``) to emit one markdown
page per public module (``main``, ``auth``, ``storage``, ``graphql``,
``functions``, ``session``, ``fetch``), grouping each module's public classes
and functions with rendered signatures and docstrings.

Run it against an environment where ``nhost`` is importable, e.g. from the SDK
package directory:

    uv run python ../../docs/pydoc-to-md.py <output-dir>

Kept dependency-free (stdlib only) so it runs under the SDK's own venv without
pulling extra doc tooling into the build.
"""

from __future__ import annotations

import importlib
import inspect
import sys
from pathlib import Path

# (import path, page title, output file). Mirrors the nhost-js / nhost-rust set.
# `main` documents the top-level factory/config surface (nhost.nhost); the rest
# document one subpackage each. `fetch` covers the middleware helpers too.
PAGES = [
    ("nhost.nhost", "Main", "main"),
    ("nhost.auth", "Auth", "auth"),
    ("nhost.storage", "Storage", "storage"),
    ("nhost.graphql", "Graphql", "graphql"),
    ("nhost.functions", "Functions", "functions"),
    ("nhost.session", "Session", "session"),
    ("nhost.fetch", "Fetch", "fetch"),
]


def is_public(name: str) -> bool:
    return not name.startswith("_")


def defined_here(obj: object, prefix: str) -> bool:
    """True if `obj` is defined in this module/subpackage (not a re-import)."""
    mod = getattr(obj, "__module__", "") or ""
    return mod == prefix or mod.startswith(prefix + ".")


def annotations_of(cls: type) -> dict[str, str]:
    """Field annotations as strings (the SDK uses `from __future__ import
    annotations`, so raw annotations are already strings)."""
    out: dict[str, str] = {}
    for klass in reversed(cls.__mro__):
        raw = klass.__dict__.get("__annotations__", {})
        for key, val in raw.items():
            if is_public(key):
                out[key] = val if isinstance(val, str) else _fmt_annotation(val)
    return out


def _fmt_annotation(val: object) -> str:
    if isinstance(val, str):
        return val
    if inspect.isclass(val):
        return val.__name__
    return str(val).replace("typing.", "")


def render_signature(name: str, obj: object) -> str:
    try:
        sig = inspect.signature(obj)
    except (ValueError, TypeError):
        return f"{name}(...)"
    # `inspect` renders string annotations verbatim, which read cleanly.
    text = f"{name}{sig}"
    prefix = "async def " if inspect.iscoroutinefunction(obj) else "def "
    return prefix + text


def clean_doc(obj: object) -> str:
    return _fence_doctests(inspect.getdoc(obj) or "")


def own_doc(cls: type) -> str:
    """Docstring defined directly on ``cls``, ignoring inherited ones.

    ``inspect.getdoc`` walks the MRO, so a model without its own docstring would
    otherwise inherit pydantic's ``BaseModel`` boilerplate (its ``__pydantic_*``
    internals) into every page — noise that is also fragile across pydantic
    versions. Keying off ``cls.__dict__`` returns only the class body's
    docstring (``None`` when absent)."""
    raw = cls.__dict__.get("__doc__")
    if not raw:
        return ""
    return _fence_doctests(inspect.cleandoc(raw))


def _fence_doctests(doc: str) -> str:
    """Wrap ``>>>`` doctest regions in ```python fences so they render as code
    blocks rather than nested markdown blockquotes."""
    lines = doc.split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith(">>>"):
            block: list[str] = []
            while i < len(lines) and lines[i].strip() != "":
                block.append(lines[i])
                i += 1
            out.append("```python")
            out.extend(block)
            out.append("```")
        else:
            out.append(lines[i])
            i += 1
    return "\n".join(out)


def is_pydantic_model(cls: type) -> bool:
    return any(b.__name__ == "BaseModel" for b in cls.__mro__)


def heading(depth: int, text: str) -> str:
    return "#" * depth + " " + text


def render_function(name: str, obj: object) -> str:
    parts = [heading(3, f"`{name}`"), "```python\n" + render_signature(name, obj) + "\n```"]
    doc = clean_doc(obj)
    if doc:
        parts.append(doc)
    return "\n\n".join(parts)


def public_methods(cls: type) -> list[tuple[str, object]]:
    methods = []
    for mname, m in inspect.getmembers(cls):
        if not is_public(mname):
            continue
        if not (inspect.isfunction(m) or inspect.ismethod(m)):
            continue
        # Only methods defined on this class (not inherited from base models).
        if mname not in cls.__dict__:
            continue
        methods.append((mname, m))
    return methods


def render_class(name: str, cls: type) -> str:
    parts = [heading(3, f"`{name}`"), "```python\n" + f"class {name}" + "\n```"]
    doc = own_doc(cls)
    if doc:
        parts.append(doc)

    if is_pydantic_model(cls):
        fields = annotations_of(cls)
        if fields:
            rows = ["| Field | Type |", "| --- | --- |"]
            rows += [f"| `{k}` | `{v}` |" for k, v in fields.items()]
            parts.append(heading(4, "Fields"))
            parts.append("\n".join(rows))

    methods = public_methods(cls)
    # Skip pydantic-internal helpers if any slipped through.
    methods = [(n, m) for n, m in methods if not n.startswith("model_")]
    if methods:
        parts.append(heading(4, "Methods"))
        for mname, m in methods:
            sub = [heading(5, f"`{mname}`"), "```python\n" + render_signature(mname, m) + "\n```"]
            mdoc = clean_doc(m)
            if mdoc:
                sub.append(mdoc)
            parts.append("\n\n".join(sub))
    return "\n\n".join(parts)


def collect(module: object, prefix: str) -> tuple[list, list]:
    functions, classes = [], []
    seen: set[str] = set()
    for name in sorted(dir(module)):
        if not is_public(name) or name in seen:
            continue
        obj = getattr(module, name)
        if not defined_here(obj, prefix):
            continue
        if inspect.isclass(obj):
            classes.append((name, obj))
            seen.add(name)
        elif inspect.isfunction(obj):
            functions.append((name, obj))
            seen.add(name)
    return functions, classes


def render_page(title: str, module: object, prefix: str) -> str:
    functions, classes = collect(module, prefix)
    out = [f"---\ntitle: {title}\n---"]
    moddoc = clean_doc(module)
    if moddoc:
        out.append(moddoc)
    if functions:
        out.append(heading(2, "Functions"))
        out += [render_function(n, o) for n, o in functions]
    if classes:
        out.append(heading(2, "Classes"))
        out += [render_class(n, c) for n, c in classes]
    return "\n\n".join(out) + "\n"


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: pydoc-to-md.py <output-dir>", file=sys.stderr)
        raise SystemExit(1)
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)

    for import_path, title, file in PAGES:
        module = importlib.import_module(import_path)
        md = render_page(title, module, import_path)
        dest = out_dir / f"{file}.md"
        dest.write_text(md)
        print(f"wrote {dest}")


if __name__ == "__main__":
    main()
