package nhost

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/cli-go/logger"
)

var (
	log    = &logger.Log
	DOMAIN = "nuno.nhost.dev"
	API    = fmt.Sprintf("https://%s/v1/functions", DOMAIN)

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

	// generate path for .gitignore file
	GITIGNORE = filepath.Join(WORKING_DIR, ".gitignore")

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
	JWT_KEY = generateRandomKey(128)

	// initiaze webhook-secret for Hasura Authentication
	WEBHOOK_SECRET = "nhost-webhook-secret"

	// initiaze admin-secret for Hasura Authentication
	ADMIN_SECRET = "nhost-admin-secret"
)

const (
	API_VERSION = "v1"
)
