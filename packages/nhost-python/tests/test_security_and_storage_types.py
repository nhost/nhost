"""Regression coverage for secret rendering and typed storage metadata."""

from __future__ import annotations

import os
import subprocess
import sys
import traceback
from pathlib import Path

import httpx
import pytest

from nhost.auth import PKCEPair, generate_pkce_pair
from nhost.storage import StorageClient, UpdateFileMetadata


def _raise_with_pair(pair: PKCEPair) -> None:
    raise RuntimeError("PKCE exchange failed")


def test_pkce_pair_never_renders_verifier(capsys: pytest.CaptureFixture[str]) -> None:
    pair = generate_pkce_pair()

    try:
        _raise_with_pair(pair)
    except RuntimeError as error:
        traceback_text = "".join(
            traceback.TracebackException.from_exception(error, capture_locals=True).format()
        )

    print(pair)
    printed = capsys.readouterr().out.strip()
    renderings = (
        repr(pair),
        str(pair),
        format(pair),
        f"{pair}",
        f"{pair!r}",
        printed,
        repr([pair]),
        repr({"pkce": pair}),
        repr((pair,)),
        traceback_text,
    )

    verifier = pair.verifier
    for rendered in renderings:
        assert verifier not in rendered
        assert pair.challenge in rendered
    assert pair.verifier == verifier
    assert "<redacted>" in repr(pair)


async def test_replace_file_content_accepts_typed_metadata_end_to_end() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            httpx.codes.OK,
            json={
                "id": "file-1",
                "name": "renamed.txt",
                "size": 11,
                "bucketId": "default",
                "etag": '"abc"',
                "createdAt": "2026-01-01T00:00:00Z",
                "updatedAt": "2026-01-01T00:00:01Z",
                "isUploaded": True,
                "mimeType": "text/plain",
                "metadata": {"alt": "profile picture"},
            },
        )

    metadata = UpdateFileMetadata(
        name="renamed.txt",
        metadata={"alt": "profile picture"},
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        storage = StorageClient("https://storage.example/v1", http_client=http)
        response = await storage.replace_file_content(
            "file-1",
            file=b"replacement",
            metadata=metadata,
        )

    assert response.status == httpx.codes.OK
    assert response.body.name == "renamed.txt"
    assert response.body.metadata == {"alt": "profile picture"}
    assert len(captured) == 1
    assert captured[0].method == "PUT"
    assert captured[0].url.path == "/v1/files/file-1"
    assert b'name="metadata"' in captured[0].content
    assert b'{"name": "renamed.txt", "metadata": {"alt": "profile picture"}}' in captured[0].content
    assert b"replacement" in captured[0].content


def test_replace_file_content_rejects_untyped_metadata_under_strict_mypy(
    tmp_path: Path,
) -> None:
    bad_call = tmp_path / "bad_storage_metadata.py"
    bad_call.write_text(
        """from nhost.storage import StorageClient


async def replace(storage: StorageClient) -> None:
    await storage.replace_file_content(
        \"file-1\", file=b\"replacement\", metadata={\"nmae\": \"typo\"}
    )
""",
        encoding="utf-8",
    )
    package_root = Path(__file__).parents[1]
    environment = os.environ.copy()
    environment["MYPYPATH"] = str(package_root / "src")
    completed = subprocess.run(
        [sys.executable, "-m", "mypy", "--strict", "--no-incremental", str(bad_call)],
        cwd=package_root,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    output = completed.stdout + completed.stderr
    assert completed.returncode == 1, output
    assert 'Argument "metadata" to "replace_file_content"' in output
    assert "UpdateFileMetadata" in output
