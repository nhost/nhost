"""Behavioral checks for the notes CLI example."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

EXAMPLE_DIR = Path(__file__).parent
REPO_ROOT = EXAMPLE_DIR.parents[2]
NOTES_CLI = EXAMPLE_DIR / "main.py"
SDK_SRC = REPO_ROOT / "packages" / "nhost-python" / "src"


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
            "PYTHONPATH": os.pathsep.join([str(tmp_path), str(SDK_SRC)]),
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
