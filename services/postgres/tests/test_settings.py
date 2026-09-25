"""Check that image defaults and PostgreSQL configuration substitutions stay in sync."""

import re
import unittest
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parents[1]
IMAGE = (ROOT / "postgres.nix").read_text(encoding="utf-8")
CONFIG = (ROOT / "postgres/etc/postgresql.conf.tmpl").read_text(encoding="utf-8")
DEFAULTS = dict(re.findall(r'^\s*"([A-Z][A-Z0-9_]*)=([^"]*)"$', IMAGE, re.M))
ASSIGNMENTS = {}
for raw_line in CONFIG.splitlines():
    line = raw_line.split("#", 1)[0].strip()
    if line and "=" in line:
        name, value = line.split("=", 1)
        ASSIGNMENTS[name.strip()] = value.strip()

# Setting name -> image env var, default, and whether the config value is quoted.
NEW_SETTINGS = {
    "wal_compression": ("WAL_COMPRESSION", "off", False),
    "max_slot_wal_keep_size": ("MAX_SLOT_WAL_KEEP_SIZE", "-1", False),
    "log_min_duration_statement": ("LOG_MIN_DURATION_STATEMENT", "-1", False),
    "log_autovacuum_min_duration": ("LOG_AUTOVACUUM_MIN_DURATION", "10min", False),
    "log_temp_files": ("LOG_TEMP_FILES", "-1", False),
    "shared_preload_libraries": (
        "SHARED_PRELOAD_LIBRARIES",
        "pg_stat_statements,pg_cron,timescaledb,pg_squeeze,pg_search,pg_durable,pg_ivm",
        True,
    ),
    "pg_stat_statements.max": ("PG_STAT_STATEMENTS_MAX", "5000", False),
    "pg_stat_statements.track": ("PG_STAT_STATEMENTS_TRACK", "top", True),
    "pg_stat_statements.track_planning": ("PG_STAT_STATEMENTS_TRACK_PLANNING", "off", False),
    "cron.timezone": ("CRON_TIMEZONE", "GMT", True),
    "cron.max_running_jobs": ("CRON_MAX_RUNNING_JOBS", "32", False),
    "cron.log_run": ("CRON_LOG_RUN", "on", False),
    "pg_durable.max_user_connections": ("PG_DURABLE_MAX_USER_CONNECTIONS", "10", False),
    "pg_durable.retention_days": ("PG_DURABLE_RETENTION_DAYS", "30", False),
    "pg_durable.log_workflow_sql": ("PG_DURABLE_LOG_WORKFLOW_SQL", "off", False),
    "timescaledb.max_background_workers": (
        "TIMESCALEDB_MAX_BACKGROUND_WORKERS", "16", False
    ),
}


class ImageSettingsTests(unittest.TestCase):
    def test_active_placeholders_have_image_defaults(self):
        for setting, value in ASSIGNMENTS.items():
            for variable in re.findall(r"\$([A-Z][A-Z0-9_]*)", value):
                with self.subTest(setting=setting, variable=variable):
                    self.assertIn(variable, DEFAULTS)

    def test_new_defaults_and_overrides_render(self):
        for setting, (variable, default, quoted) in NEW_SETTINGS.items():
            with self.subTest(setting=setting):
                self.assertEqual(DEFAULTS[variable], default)
                template = ASSIGNMENTS[setting]
                self.assertEqual(template, f"'${variable}'" if quoted else f"${variable}")
                self.assertEqual(
                    Template(template).substitute(DEFAULTS),
                    f"'{default}'" if quoted else default,
                )
                override = "example" if quoted else "1"
                self.assertEqual(
                    Template(template).substitute(DEFAULTS | {variable: override}),
                    f"'{override}'" if quoted else override,
                )

    def test_checkpoint_timeout_has_default(self):
        self.assertEqual(DEFAULTS["CHECKPOINT_TIMEOUT"], "5min")
        self.assertEqual(ASSIGNMENTS["checkpoint_timeout"], "$CHECKPOINT_TIMEOUT")


if __name__ == "__main__":
    unittest.main()
