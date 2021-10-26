package nhost

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
)

var (
	log    = &logger.Log
	DOMAIN = "nuno.run"
	API    = fmt.Sprintf("https://%s/v1/functions", DOMAIN)

	//  fetch current working directory
	NHOST_DIR    = filepath.Join(util.WORKING_DIR, "nhost")
	DOT_NHOST, _ = GetDotNhost()

	//  initialize the names of all Nhost services in the stack
	SERVICES = []string{"hasura", "auth", "storage", "mailhog", "postgres", "minio"}

	//  find user's home directory
	HOME, _ = os.UserHomeDir()

	//  generate Nhost root directory for HOME
	ROOT = filepath.Join(HOME, ".nhost")

	//  generate authentication file location
	AUTH_PATH = filepath.Join(ROOT, "auth.json")

	//  generate path for migrations
	MIGRATIONS_DIR = filepath.Join(NHOST_DIR, "migrations")

	//  generate path for metadata
	METADATA_DIR = filepath.Join(NHOST_DIR, "metadata")

	//  default Nhost database
	DATABASE = "default"

	//  generate path for seeds
	SEEDS_DIR = filepath.Join(NHOST_DIR, "seeds")

	//  generate path for frontend
	WEB_DIR = filepath.Join(util.WORKING_DIR, "web")

	//  generate path for API code
	API_DIR = filepath.Join(util.WORKING_DIR, "functions")

	//  generate path for email templates
	EMAILS_DIR = filepath.Join(NHOST_DIR, "emails")

	//  generate path for legacy migrations
	LEGACY_DIR = filepath.Join(DOT_NHOST, "legacy")

	//  generate path for local git directory
	GIT_DIR = filepath.Join(util.WORKING_DIR, ".git")

	//  default git repository remote to watch for git ops
	REMOTE = "origin"

	//  generate path for .env.development
	ENV_FILE = filepath.Join(util.WORKING_DIR, ".env.development")

	//  generate path for .config.yaml file
	CONFIG_PATH = filepath.Join(NHOST_DIR, "config.yaml")

	//  generate path for .gitignore file
	GITIGNORE = filepath.Join(util.WORKING_DIR, ".gitignore")

	//  generate path for .nhost/nhost.yaml file
	INFO_PATH = filepath.Join(DOT_NHOST, "nhost.yaml")

	//  generate path for express NPM modules
	NODE_MODULES_PATH = filepath.Join(ROOT, "node_modules")

	//  package repository to download latest release from
	REPOSITORY = "nhost/cli"

	//  initialize the project prefix
	PREFIX = filepath.Base(util.WORKING_DIR)
	//PREFIX = "nhost"
)
