"""Behavioral checks for the webhook receiver example."""

from __future__ import annotations

import hashlib
import hmac
import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from nhost import GraphQLExecutionError

WEBHOOK_APP = Path(__file__).parent / "app.py"


class GuardGraphQL:
    """Fail if a request that should be rejected reaches GraphQL."""

    def __init__(self) -> None:
        self.calls = 0

    async def request(self, *_: object, **__: object) -> SimpleNamespace:
        self.calls += 1
        raise AssertionError("rejected webhook must not reach GraphQL")


def _load_webhook_app(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.setenv("WEBHOOK_SECRET", "test-webhook-secret")
    monkeypatch.setenv("HASURA_ADMIN_SECRET", "test-admin-secret")
    monkeypatch.setenv("WEBHOOK_SOURCE", "stripe")
    spec = importlib.util.spec_from_file_location("webhook_receiver_app", WEBHOOK_APP)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _signature(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def _post(
    module: ModuleType,
    body: bytes,
    headers: dict[str, str] | list[tuple[bytes, bytes]] | None = None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/webhook", content=body, headers=headers)


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
@pytest.mark.parametrize(
    "signature",
    [
        None,
        "sha256=" + "0" * 64,
        "garbage",
    ],
    ids=["missing", "wrong", "malformed"],
)
async def test_unsigned_webhook_is_rejected_and_not_recorded(
    monkeypatch: pytest.MonkeyPatch,
    signature: str | None,
) -> None:
    module = _load_webhook_app(monkeypatch)
    graphql = GuardGraphQL()
    module.app.state.nhost = SimpleNamespace(graphql=graphql)
    headers = {} if signature is None else {"x-webhook-signature": signature}

    response = await _post(module, b'{"type":"payment.succeeded"}', headers)

    assert response.status_code == 401
    assert graphql.calls == 0


@pytest.mark.asyncio
async def test_non_ascii_signature_is_rejected_and_not_recorded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    graphql = GuardGraphQL()
    module.app.state.nhost = SimpleNamespace(graphql=graphql)

    response = await _post(
        module,
        b'{"type":"payment.succeeded"}',
        [(b"x-webhook-signature", b"sha256=" + b"0" * 63 + b"\xff")],
    )

    assert response.status_code == 401
    assert graphql.calls == 0


@pytest.mark.asyncio
async def test_tampered_webhook_is_rejected_and_not_recorded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    graphql = GuardGraphQL()
    module.app.state.nhost = SimpleNamespace(graphql=graphql)
    signed_body = b'{"type":"payment.succeeded"}'
    tampered_body = b'{"type":"payment.failed"}'

    response = await _post(
        module,
        tampered_body,
        {"x-webhook-signature": _signature(module.WEBHOOK_SECRET, signed_body)},
    )

    assert response.status_code == 401
    assert graphql.calls == 0


@pytest.mark.asyncio
async def test_oversized_webhook_is_rejected_through_asgi(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    graphql = GuardGraphQL()
    module.app.state.nhost = SimpleNamespace(graphql=graphql)

    response = await _post(module, b"x" * (module.MAX_BODY_BYTES + 1))

    assert response.status_code == 413
    assert graphql.calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [b"[]", b'"x"', b"null"], ids=["array", "string", "null"])
async def test_non_object_json_is_rejected_and_not_recorded(
    monkeypatch: pytest.MonkeyPatch,
    body: bytes,
) -> None:
    module = _load_webhook_app(monkeypatch)
    graphql = GuardGraphQL()
    module.app.state.nhost = SimpleNamespace(graphql=graphql)

    response = await _post(
        module,
        body,
        {"x-webhook-signature": _signature(module.WEBHOOK_SECRET, body)},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "body must be a JSON object"}
    assert graphql.calls == 0


@pytest.mark.asyncio
async def test_correctly_signed_normal_webhook_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_webhook_app(monkeypatch)
    body = b'{"type":"payment.succeeded","data":{"amount":4200}}'
    signature = _signature(module.WEBHOOK_SECRET, body)

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
    response = await _post(
        module,
        body,
        {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            # A client-controlled label cannot override server-side provenance.
            "x-webhook-source": "forged-source",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "recorded": {"id": "event-id", "received_at": "2026-01-01T00:00:00Z"}
    }


@pytest.mark.asyncio
async def test_graphql_execution_failure_returns_retryable_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_webhook_app(monkeypatch)
    body = b'{"type":"payment.succeeded"}'

    class FailingGraphQL:
        async def request(self, *_: object, **__: object) -> None:
            response = httpx.Response(
                200,
                request=httpx.Request("POST", "http://graphql.test/v1"),
            )
            result = SimpleNamespace(
                errors=[SimpleNamespace(message="database unavailable")],
                data=None,
            )
            raise GraphQLExecutionError(response, result)

    module.app.state.nhost = SimpleNamespace(graphql=FailingGraphQL())
    response = await _post(
        module,
        body,
        {"x-webhook-signature": _signature(module.WEBHOOK_SECRET, body)},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "failed to record event"}
