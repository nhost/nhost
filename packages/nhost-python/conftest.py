"""Pytest configuration for the Nhost Python SDK.

Docstring examples are executable documentation (the Python counterpart of
nhost-js's ``docstrings.test.ts``). Run them with::

    pytest --doctest-modules src tests

Pure examples (e.g. URL building) always run as a canary that the doctest
harness is wired. Examples that talk to a backend — and any test marked
``@pytest.mark.integration`` — only run when a local Nhost backend is available,
signalled by ``NHOST_LOCAL_BACKEND=1`` (bring one up with ``./dev-env.sh up``).
This keeps the offline unit suite green while matching nhost-js, where the
docstring examples execute against the ``local``/``local`` backend.
"""

from __future__ import annotations

import os

import pytest

# Doctests (by fully-qualified name) whose examples perform live backend I/O.
# Everything else — including pure examples like ``generate_service_url`` — runs
# offline as a canary that the doctest harness is wired.
_BACKEND_DEPENDENT_DOCTESTS = frozenset(
    {
        "nhost.nhost.create_client",
        "nhost.graphql.client.Client.request",
        "nhost.functions.client.Client.post",
    }
)


def _backend_enabled() -> bool:
    return os.environ.get("NHOST_LOCAL_BACKEND", "").lower() in {"1", "true", "yes"}


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "integration: test requires a local Nhost backend (set NHOST_LOCAL_BACKEND=1)",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _backend_enabled():
        return

    skip_backend = pytest.mark.skip(
        reason="needs a local Nhost backend; set NHOST_LOCAL_BACKEND=1 (./dev-env.sh up)"
    )
    for item in items:
        # A DoctestItem's name is the fully-qualified example name, e.g.
        # "nhost.nhost.create_client".
        is_backend_doctest = (
            type(item).__name__ == "DoctestItem" and item.name in _BACKEND_DEPENDENT_DOCTESTS
        )
        if is_backend_doctest or item.get_closest_marker("integration"):
            item.add_marker(skip_backend)
