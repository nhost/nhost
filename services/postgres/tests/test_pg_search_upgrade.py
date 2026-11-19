"""Check startup routing without requiring an image or a running PostgreSQL."""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ExtensionUpgradeRoutingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.functions = self.root / "init-functions.sh"
        source = (ROOT / "postgres/bin/init.sh").read_text()
        self.assertTrue(source.endswith("\nmain\n"))
        self.functions.write_text(source.removesuffix("main\n"))
        self.generic = self.root / "generic.sql"
        self.generic.write_text('ALTER EXTENSION :"extension" UPDATE;\n')
        self.trace = self.root / "trace.jsonl"
        binaries = self.root / "bin"
        binaries.mkdir()
        stub = binaries / "psql"
        stub.write_text(
            """#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

args = sys.argv[1:]
entry = {"args": args, "database": os.environ["PGDATABASE"]}
if "-f" in args:
    path = Path(args[args.index("-f") + 1])
    entry["file"] = str(path)
    if path.exists():
        entry["sql"] = path.read_text()
with open(os.environ["PSQL_TRACE"], "a") as trace:
    trace.write(json.dumps(entry) + "\\n")
if "-c" in args and os.environ.get("DEPENDENCY_FAIL") == "1":
    sys.exit(3)
if "-f" in args and os.environ.get("UPDATE_FAIL") == "1":
    sys.exit(3)
"""
        )
        stub.chmod(0o755)
        self.env = os.environ | {
            "PATH": f"{binaries}:{os.environ['PATH']}",
            "PSQL_TRACE": str(self.trace),
            "TEST_TMP": str(self.root),
        }

    def run_update(self, extension, *, extra=None, then_hstore=False):
        script = """
set -eu
. "$1"
# Keep production arguments/routing unchanged; isolate only its log directory.
mktemp() { command mktemp "$TEST_TMP/update-log.XXXXXX"; }
update_extension "$2" "$3" "$4"
"""
        if then_hstore:
            script += 'update_extension "$2" hstore "$4"\n'
        result = subprocess.run(
            ["sh", "-c", script, "test", str(self.functions), "app=old, quoted", extension, str(self.generic)],
            env=self.env | (extra or {}),
            capture_output=True,
            text=True,
            check=False,
        )
        calls = [json.loads(line) for line in self.trace.read_text().splitlines()]
        self.assertFalse(list(self.root.glob("update-log.*")))
        self.assertTrue(all(call["database"] == "app=old, quoted" for call in calls))
        return result, calls

    def test_pg_search_uses_atomic_upgrade_after_dependency_session(self):
        result, calls = self.run_update("pg_search")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["args"][calls[0]["args"].index("-c") + 1],
                         "CREATE EXTENSION IF NOT EXISTS vector;")
        self.assertEqual(calls[1]["file"], "/bin/upgrade-pg-search.sql")
        self.assertNotIn("-c", calls[1]["args"])
        for call in calls:
            self.assertIn("-X", call["args"])
            self.assertIn("ON_ERROR_STOP=1", call["args"])

    def test_other_extensions_keep_the_one_statement_session(self):
        for extension in ("timescaledb", "postgis_tiger_geocoder", "hstore"):
            with self.subTest(extension=extension):
                self.trace.write_text("")
                result, calls = self.run_update(extension)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(len(calls), 1)
                self.assertEqual(calls[0]["sql"], 'ALTER EXTENSION :"extension" UPDATE;\n')
                self.assertNotIn("-c", calls[0]["args"])

    def test_pg_search_does_not_replace_following_extensions_script(self):
        result, calls = self.run_update("pg_search", then_hstore=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[-1]["file"], str(self.generic))
        self.assertEqual(calls[-1]["sql"], 'ALTER EXTENSION :"extension" UPDATE;\n')

    def test_dependency_failure_skips_upgrade_and_remains_nonfatal_to_caller(self):
        result, calls = self.run_update("pg_search", extra={"DEPENDENCY_FAIL": "1"})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)
        self.assertIn("Failed to update extension pg_search", result.stderr)
        self.assertIn("continuing startup", result.stderr)

    def test_maintenance_failure_is_reported(self):
        result, calls = self.run_update("pg_search", extra={"UPDATE_FAIL": "1"})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 2)
        self.assertIn("Failed to update extension pg_search", result.stderr)


if __name__ == "__main__":
    unittest.main()
