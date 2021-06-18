package nhost

import (
	"os"
	"path"
)

var (
	API = "https://customapi.nhost.io"

	// fetch current working directory
	WORKING_DIR, _ = os.Getwd()
	NHOST_DIR      = path.Join(WORKING_DIR, "nhost")
	DOT_NHOST      = path.Join(WORKING_DIR, ".nhost")

	// find user's home directory
	HOME, _ = os.UserHomeDir()

	// generate Nhost root directory for HOME
	ROOT = path.Join(HOME, ".nhost")

	// generate authentication file location
	AUTH_PATH = path.Join(ROOT, "auth.json")

	// generate path for migrations
	MIGRATIONS_DIR = path.Join(NHOST_DIR, "migrations")

	// generate path for metadata
	METADATA_DIR = path.Join(NHOST_DIR, "metadata")

	// generate path for seeds
	SEEDS_DIR = path.Join(NHOST_DIR, "seeds")

	// generate path for frontend
	WED_DIR = path.Join(NHOST_DIR, "web")

	// generate path for API code
	API_DIR = path.Join(WORKING_DIR, "api")

	// generate path for legacy migrations
	LEGACY_DIR = path.Join(DOT_NHOST, "legacy")

	// generate path for .env.development
	ENV_FILE = path.Join(WORKING_DIR, ".env.development")

	// generate path for .config.yaml file
	CONFIG_PATH = path.Join(NHOST_DIR, "config.yaml")

	// generate path for .nhost/nhost.yaml file
	INFO_PATH = path.Join(DOT_NHOST, "nhost.yaml")

	// package repository to download latest release from
	REPOSITORY = "mrinalwahal/cli"
)
