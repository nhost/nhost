"""Regression checks for Python snippets in the getting-started documentation."""

from __future__ import annotations

import ast
import importlib
import inspect
import re
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

from nhost import Nhost

_REPO_ROOT = Path(__file__).parents[3]
_DOCS = (
    _REPO_ROOT / "docs/src/content/docs/getting-started/index.mdx",
    _REPO_ROOT / "docs/src/content/docs/getting-started/quickstart/fastapi.mdx",
    *sorted((_REPO_ROOT / "docs/src/content/docs/getting-started/tutorials/python").glob("*.mdx")),
)
_PYTHON_FENCE = re.compile(r"^```python[^\n]*\n(.*?)^```$", re.MULTILINE | re.DOTALL)
_BODY_METHODS = {
    "sign_in_email_password",
    "sign_out",
    "sign_up_email_password",
    "upload_files",
}
# Derived from the client rather than listed, so renaming or adding an async
# method cannot leave the "must be awaited" guard quietly covering a name that
# no longer exists: get_user_session was renamed to get_session and the listed
# version kept passing while checking nothing.
_ASYNC_SESSION_METHODS = {
    name
    for name, _ in inspect.getmembers(Nhost, inspect.iscoroutinefunction)
    if not name.startswith("_")
}
_CLIENT_FACTORIES: dict[str, Callable[..., object]] = {"Nhost": Nhost}
_FACTORY_PARAMETERS = {
    name: inspect.signature(factory).parameters for name, factory in _CLIENT_FACTORIES.items()
}
_FACTORY_REQUIRED_KEYWORDS = {
    name: {
        parameter.name
        for parameter in parameters.values()
        if parameter.kind is inspect.Parameter.KEYWORD_ONLY
        and parameter.default is inspect.Parameter.empty
    }
    for name, parameters in _FACTORY_PARAMETERS.items()
}


def _snippets() -> Iterator[object]:
    for path in _DOCS:
        for index, match in enumerate(_PYTHON_FENCE.finditer(path.read_text()), start=1):
            yield pytest.param(match.group(1), id=f"{path.stem}-{index}")


def _is_complete(source: str) -> bool:
    """A tutorial part's whole main.py, or the quickstart's FastAPI app."""
    return "def main(" in source or "FastAPI(" in source


def _validate_sdk_calls(source: str) -> None:
    tree = ast.parse(source)
    parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
    loaded_names = {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load)
    }

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = {alias.name for alias in node.names}
            assert "NhostClientOptions" not in names
            # A snippet that adds to an earlier one may show a whole import line
            # whose names are used elsewhere in the file; only a complete
            # program has to use everything it imports.
            if "NhostError" in names and _is_complete(source):
                assert "NhostError" in loaded_names, "NhostError must be used when imported"

        if not isinstance(node, ast.Call):
            continue

        if isinstance(node.func, ast.Name) and node.func.id in _CLIENT_FACTORIES:
            factory_name = node.func.id
            assert not node.args, f"{factory_name} accepts keyword arguments only"
            assert all(keyword.arg is not None for keyword in node.keywords), (
                f"{factory_name} arguments must be explicit"
            )
            keyword_names = {keyword.arg for keyword in node.keywords if keyword.arg is not None}
            unexpected = keyword_names - _FACTORY_PARAMETERS[factory_name].keys()
            assert not unexpected, (
                f"{factory_name} got unexpected keyword arguments: {sorted(unexpected)}"
            )
            missing = _FACTORY_REQUIRED_KEYWORDS[factory_name] - keyword_names
            assert not missing, (
                f"{factory_name} is missing required keyword arguments: {sorted(missing)}"
            )

        if not isinstance(node.func, ast.Attribute):
            continue

        method = node.func.attr
        if method in _ASYNC_SESSION_METHODS:
            assert isinstance(parents[node], ast.Await), f"{method} must be awaited"
        if method in _BODY_METHODS:
            assert not node.args, f"{method} accepts its request body by keyword only"
            assert any(keyword.arg == "body" for keyword in node.keywords)
        if method == "post":
            assert len(node.args) <= 1, "Functions post payload must use json=..."


def _validate_sdk_imports(source: str) -> None:
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.ImportFrom) or node.module is None:
            continue
        if node.module != "nhost" and not node.module.startswith("nhost."):
            continue

        module = importlib.import_module(node.module)
        for alias in node.names:
            if alias.name == "*":
                continue
            assert hasattr(module, alias.name), f"{node.module} does not export {alias.name!r}"


def test_async_session_methods_were_discovered() -> None:
    """Guard the guard: an empty set would silently check nothing."""
    assert "get_session" in _ASYNC_SESSION_METHODS
    assert "clear_session" in _ASYNC_SESSION_METHODS


def test_snippets_were_found() -> None:
    """A fence pattern that stopped matching would check nothing."""
    ids = {param.id for param in _snippets()}  # type: ignore[attr-defined]
    assert any(i.startswith("fastapi-") for i in ids)
    assert sum(i.startswith("5-functions-sharing-") for i in ids) > 1


@pytest.mark.parametrize("source", list(_snippets()))
def test_python_tutorial_snippet_uses_current_sdk(source: str) -> None:
    """Keep parseable snippets free of SDK call shapes that previously drifted."""
    _validate_sdk_calls(source)


@pytest.mark.parametrize("source", list(_snippets()))
def test_python_tutorial_snippet_imports_exist(source: str) -> None:
    """Every name a snippet imports from the SDK has to still be exported.

    Call-shape validation only inspects calls, so a snippet could import a
    deleted symbol and pass: the fastapi quickstart went on importing
    with_chain_functions after it became with_middleware, and nothing failed.
    """
    _validate_sdk_imports(source)


@pytest.mark.parametrize(
    "source",
    (
        pytest.param("from nhost import with_chain_functions", id="with-chain-functions"),
        pytest.param("from nhost import create_api_client", id="create-api-client"),
        pytest.param("from nhost.session import detect_storage", id="detect-storage"),
        pytest.param("from nhost.fetch import ChainFunction", id="chain-function"),
        pytest.param("from nhost import create_client", id="create-client"),
        pytest.param("from nhost import NhostClient", id="nhost-client"),
        pytest.param("from nhost import MemoryStorage", id="memory-storage"),
        pytest.param("from nhost import FileStorage", id="file-storage"),
    ),
)
def test_removed_sdk_imports_are_rejected(source: str) -> None:
    """The import check must fail on the symbols this SDK actually dropped."""
    with pytest.raises(AssertionError, match="does not export"):
        _validate_sdk_imports(source)


@pytest.mark.parametrize(
    ("source", "message"),
    (
        pytest.param(
            "Nhost(NhostClientOptions())",
            "Nhost accepts keyword arguments only",
            id="nhost-positional-options",
        ),
        pytest.param(
            "Nhost(session_storage=MemoryStorage())",
            "Nhost got unexpected keyword arguments: ['session_storage']",
            id="nhost-session-storage",
        ),
        pytest.param(
            "Nhost(configure=[with_admin_session(options)])",
            "Nhost got unexpected keyword arguments: ['configure']",
            id="nhost-configure",
        ),
        pytest.param(
            "from nhost import NhostError\n\ndef main() -> None: ...",
            "NhostError must be used when imported",
            id="unused-nhost-error",
        ),
    ),
)
def test_outdated_factory_shapes_are_rejected(source: str, message: str) -> None:
    """Exercise every factory guard independently of the current tutorial examples."""
    with pytest.raises(AssertionError, match=re.escape(message)):
        _validate_sdk_calls(source)
