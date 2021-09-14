package nhost

import (
	"os"
	"path/filepath"

	"github.com/mrinalwahal/cli/logger"
)

var (
	log = &logger.Log
	API = "https://customapi.nhost.io"

	// fetch current working directory
	WORKING_DIR, _ = os.Getwd()
	NHOST_DIR      = filepath.Join(WORKING_DIR, "nhost")
	DOT_NHOST, _   = GetDotNhost()

	// initialize the names of all Nhost services in the stack
	SERVICES = []string{"hasura", "auth", "storage", "mailhog", "postgres", "minio"}

	// find user's home directory
	HOME, _ = os.UserHomeDir()

	// generate Nhost root directory for HOME
	ROOT = filepath.Join(HOME, ".nhost")

	// generate authentication file location
	AUTH_PATH = filepath.Join(ROOT, "auth.json")

	// generate path for migrations
	MIGRATIONS_DIR = filepath.Join(NHOST_DIR, "migrations")

	// generate path for metadata
	METADATA_DIR = filepath.Join(NHOST_DIR, "metadata")

	// default Nhost database
	DATABASE = "default"

	// generate path for seeds
	SEEDS_DIR = filepath.Join(NHOST_DIR, "seeds")

	// generate path for frontend
	WEB_DIR = filepath.Join(WORKING_DIR, "web")

	// generate path for API code
	API_DIR = filepath.Join(WORKING_DIR, "functions")

	// generate path for email templates
	EMAILS_DIR = filepath.Join(NHOST_DIR, "emails")

	// generate path for legacy migrations
	LEGACY_DIR = filepath.Join(DOT_NHOST, "legacy")

	// generate path for local git directory
	GIT_DIR = filepath.Join(WORKING_DIR, ".git")

	// default git repository remote to watch for git ops
	REMOTE = "origin"

	// generate path for .env.development
	ENV_FILE = filepath.Join(WORKING_DIR, ".env.development")

	// generate path for .config.yaml file
	CONFIG_PATH = filepath.Join(NHOST_DIR, "config.yaml")

	// generate path for .nhost/nhost.yaml file
	INFO_PATH = filepath.Join(DOT_NHOST, "nhost.yaml")

	// generate path for express NPM modules
	NODE_MODULES_PATH = filepath.Join(ROOT, "node_modules")

	// package repository to download latest release from
	REPOSITORY = "nhost/cli-go"

	// initialize the project prefix
	PREFIX = filepath.Base(WORKING_DIR)
	//PREFIX = "nhost"

	// initiaze JWT key for Hasura Authentication
	JWT_KEY = generateRandomKey()
)

const (
	API_VERSION = "v1"
)
