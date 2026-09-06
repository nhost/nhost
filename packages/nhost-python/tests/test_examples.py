"""Behavioral checks for the executable Python examples."""

from __future__ import annotations

import hashlib
import hmac
import importlib.util
import os
import subprocess
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

PACKAGE_DIR = Path(__file__).parents[1]
NOTES_CLI = PACKAGE_DIR / "examples" / "notes-cli" / "main.py"
WEBHOOK_APP = PACKAGE_DIR / "examples" / "webhook-receiver" / "app.py"


def _load_webhook_app(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.setenv("WEBHOOK_SECRET", "test-webhook-secret")
    monkeypatch.setenv("HASURA_ADMIN_SECRET", "test-admin-secret")
    spec = importlib.util.spec_from_file_location("webhook_receiver_app", WEBHOOK_APP)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(
    not Path("/proc/self/cmdline").exists(),
    reason="process argv proof requires Linux procfs",
)
def test_notes_password_stays_out_of_process_argv(tmp_path: Path) -> None:
    proof = tmp_path / "proof"
    sitecustomize = tmp_path / "sitecustomize.py"
    sitecustomize.write_text(
        """
import os
from pathlib import Path
from nhost.auth import Client

async def fake_sign_in(self, body):
    cmdline = Path('/proc/self/cmdline').read_bytes()
    Path(os.environ['ARGV_PROOF']).write_bytes(cmdline + b'\\nPASSWORD=' + body.password.encode())

Client.sign_in_email_password = fake_sign_in
"""
    )
    secret = "process-table-secret"
    env = os.environ.copy()
    env.update(
        {
            "ARGV_PROOF": str(proof),
            "NHOST_NOTES_SESSION": str(tmp_path / "session.json"),
            "NOTES_PASSWORD": secret,
            "PYTHONPATH": os.pathsep.join([str(tmp_path), str(PACKAGE_DIR / "src")]),
        }
    )

    result = subprocess.run(
        [sys.executable, str(NOTES_CLI), "login", "ada@example.com"],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "logged in as ada@example.com"
    cmdline, supplied_password = proof.read_bytes().split(b"\nPASSWORD=", maxsplit=1)
    assert secret.encode() not in cmdline
    assert supplied_password == secret.encode()


@pytest.mark.asyncio
async def test_declared_oversized_webhook_is_rejected_without_reading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    receive_calls = 0

    async def receive() -> dict[str, object]:
        nonlocal receive_calls
        receive_calls += 1
        raise AssertionError("oversized declared body must not be read")

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/webhook",
            "headers": [(b"content-length", str(module.MAX_BODY_BYTES + 1).encode())],
        },
        receive,
    )

    with pytest.raises(HTTPException) as exc_info:
        await module._read_capped_body(request)

    assert exc_info.value.status_code == 413
    assert receive_calls == 0


@pytest.mark.asyncio
async def test_chunked_oversized_webhook_stops_reading_at_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    messages = [
        {"type": "http.request", "body": b"a" * 600_000, "more_body": True},
        {"type": "http.request", "body": b"b" * 500_000, "more_body": True},
        {"type": "http.request", "body": b"unread", "more_body": False},
    ]
    receive_calls = 0

    async def receive() -> dict[str, object]:
        nonlocal receive_calls
        message = messages[receive_calls]
        receive_calls += 1
        return message

    request = Request(
        {"type": "http", "method": "POST", "path": "/webhook", "headers": []},
        receive,
    )

    with pytest.raises(HTTPException) as exc_info:
        await module._read_capped_body(request)

    assert exc_info.value.status_code == 413
    assert receive_calls == 2


@pytest.mark.asyncio
async def test_correctly_signed_normal_webhook_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_webhook_app(monkeypatch)
    body = b'{"type":"payment.succeeded","data":{"amount":4200}}'
    signature = (
        "sha256=" + hmac.new(module.WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    )

    class FakeGraphQL:
        async def request(self, query: str, variables: dict[str, object]) -> SimpleNamespace:
            assert query == module.INSERT_EVENT
            assert variables["object"] == {
                "source": "stripe",
                "event_type": "payment.succeeded",
                "payload": {"type": "payment.succeeded", "data": {"amount": 4200}},
            }
            return SimpleNamespace(
                body=SimpleNamespace(
                    data={
                        "insert_webhook_events_one": {
                            "id": "event-id",
                            "received_at": "2026-01-01T00:00:00Z",
                        }
                    }
                )
            )

    module.app.state.nhost = SimpleNamespace(graphql=FakeGraphQL())
    transport = httpx.ASGITransport(app=module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/webhook",
            content=body,
            headers={
                "content-type": "application/json",
                "x-webhook-signature": signature,
                "x-webhook-source": "stripe",
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "recorded": {"id": "event-id", "received_at": "2026-01-01T00:00:00Z"}
    }
