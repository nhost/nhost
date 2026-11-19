"""Check PostgreSQL image tags without building or stamping project files."""

import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


class PostgresTagsTests(unittest.TestCase):
    def test_tags_require_a_leading_pg_version(self):
        for major, full in [("17", "17.12"), ("18", "18.7")]:
            cases = [
                ("20261117-1", f"{full}-20261117-1"),
                ("20261118-1", f"{full}-20261118-1"),
                ("0.0.0-dev", f"{full}-0.0.0-dev"),
                (f"{full}-20261118-1", f"{full}-20261118-1"),
                (f"{major}.1-20261118-1", f"{major}.1-20261118-1"),
                (f"release-{full}", f"{full}-release-{full}"),
                (f"1{full}-20261118-1", f"{full}-1{full}-20261118-1"),
            ]
            for version, expected in cases:
                with self.subTest(major=major, version=version):
                    result = subprocess.run(
                        [
                            "make",
                            "-n",
                            "--no-print-directory",
                            "-C",
                            str(REPO / "services/postgres"),
                            "get-version",
                            f"POSTGRES_VERSION={major}",
                            f"POSTGRES_FULL_VERSION={full}",
                            f"VER={version}",
                        ],
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout.splitlines()[-1], f"echo {expected}")


if __name__ == "__main__":
    unittest.main()
