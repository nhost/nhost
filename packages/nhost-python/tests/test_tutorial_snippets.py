"""Regression checks for Python snippets in the getting-started documentation."""

from __future__ import annotations

import ast
import inspect
import re
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

from nhost import create_client, create_nhost_client, create_server_client

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
_ASYNC_SESSION_METHODS = {"clear_session", "get_user_session"}
_CLIENT_FACTORIES: dict[str, Callable[..., object]] = {
    "create_client": create_client,
    "create_nhost_client": create_nhost_client,
    "create_server_client": create_server_client,
}
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
            if "NhostError" in names:
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


@pytest.mark.parametrize("source", list(_snippets()))
def test_python_tutorial_snippet_uses_current_sdk(source: str) -> None:
    """Keep parseable snippets free of SDK call shapes that previously drifted."""
    _validate_sdk_calls(source)


@pytest.mark.parametrize(
    ("source", "message"),
    (
        pytest.param(
            "create_client(NhostClientOptions())",
            "create_client accepts keyword arguments only",
            id="create-client-positional-options",
        ),
        pytest.param(
            "create_server_client(storage=MemoryStorage())",
            "create_server_client got unexpected keyword arguments: ['storage']",
            id="create-server-client-storage",
        ),
        pytest.param(
            "create_nhost_client(NhostClientOptions())",
            "create_nhost_client accepts keyword arguments only",
            id="create-nhost-client-positional-options",
        ),
        pytest.param(
            "create_server_client()",
            "create_server_client is missing required keyword arguments: ['session_storage']",
            id="create-server-client-missing-session-storage",
        ),
        pytest.param(
            "from nhost import NhostError",
            "NhostError must be used when imported",
            id="unused-nhost-error",
        ),
    ),
)
def test_outdated_factory_shapes_are_rejected(source: str, message: str) -> None:
    """Exercise every factory guard independently of the current tutorial examples."""
    with pytest.raises(AssertionError, match=re.escape(message)):
        _validate_sdk_calls(source)
