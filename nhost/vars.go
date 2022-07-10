package nhost

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
)

const (
	DB_USER     = "postgres"
	DB_PASSWORD = "postgres"

	MINIO_USER     = "minioaccesskey123123"
	MINIO_PASSWORD = "minioaccesskey123123"
)

var (
	log    = &logger.Log
	DOMAIN string
	API    string

	//  fetch current working directory
	NHOST_DIR string

	//  initialize the names of all Nhost services in the stack
	SERVICES []string

	//  find user's home directory
	HOME string

	//  Nhost root directory for HOME
	ROOT string

	//  authentication file location
	AUTH_PATH string

	//  path for migrations
	MIGRATIONS_DIR string

	//  path for metadata
	METADATA_DIR string

	//  default Nhost database
	DATABASE string

	//  path for seeds
	SEEDS_DIR string

	//  path for .nhost
	DOT_NHOST_DIR string

	//  path for frontend
	WEB_DIR string

	//  path for API code
	API_DIR string

	//  path for email templates
	EMAILS_DIR string

	//  path for legacy migrations
	LEGACY_DIR string

	//  path for local git directory
	GIT_DIR string

	//  default git repository remote to watch for git ops
	REMOTE string

	//  path for .env.development
	ENV_FILE string

	//  path for config.yaml file
	CONFIG_PATH string

	//  path for .gitignore file
	GITIGNORE string

	//  path for .nhost/nhost.yaml file
	INFO_PATH string

	//  path for express NPM modules
	NODE_MODULES_PATH string

	//  package repository to download latest release from
	REPOSITORY string

	//  initialize the project prefix
	PREFIX string

	//	mandatorily required locations
	LOCATIONS Required
)

//	Initialize Nhost variables for runtime
func Init() {
	DOMAIN = "nhost.run"

	API = fmt.Sprintf("https://%s/v1/functions", DOMAIN)

	//  fetch current working directory
	NHOST_DIR = filepath.Join(util.WORKING_DIR, "nhost")

	INFO_PATH = filepath.Join(util.WORKING_DIR, ".nhost", "nhost.yaml")


	//  initialize the names of all Nhost services in the stack
	SERVICES = []string{"hasura", "auth", "storage", "mailhog", "postgres", "minio"}

	//  find user's home directory
	HOME, _ = os.UserHomeDir()

	//  Nhost root directory for HOME
	ROOT = filepath.Join(HOME, ".nhost")

	//  authentication file location
	AUTH_PATH = filepath.Join(ROOT, "auth.json")

	//  path for migrations
	MIGRATIONS_DIR = filepath.Join(NHOST_DIR, "migrations")

	//  path for metadata
	METADATA_DIR = filepath.Join(NHOST_DIR, "metadata")

	//  default Nhost database
	DATABASE = "default"

	//  path for seeds
	SEEDS_DIR = filepath.Join(NHOST_DIR, "seeds")

	DOT_NHOST_DIR = filepath.Join(util.WORKING_DIR, ".nhost")

	//  path for frontend
	WEB_DIR = filepath.Join(util.WORKING_DIR, "web")

	//  path for API code
	API_DIR = filepath.Join(util.WORKING_DIR, "functions")

	//  path for email templates
	EMAILS_DIR = filepath.Join(NHOST_DIR, "emails")

	//  path for legacy migrations
	LEGACY_DIR = filepath.Join(DOT_NHOST, "legacy")

	//  path for local git directory
	GIT_DIR = filepath.Join(util.WORKING_DIR, ".git")

	//  path for .env.development
	ENV_FILE = filepath.Join(util.WORKING_DIR, ".env.development")

	//  path for .config.yaml file
	CONFIG_PATH = filepath.Join(NHOST_DIR, "config.yaml")

	//  path for .gitignore file
	GITIGNORE = filepath.Join(util.WORKING_DIR, ".gitignore")

	//  path for express NPM modules
	NODE_MODULES_PATH = filepath.Join(ROOT, "node_modules")

	//  package repository to download latest release from
	REPOSITORY = "nhost/cli"

	//	mandatorily required locations
	LOCATIONS = Required{
		Directories: []*string{
			&ROOT,
			&DOT_NHOST_DIR,
			&NHOST_DIR,
			&MIGRATIONS_DIR,
			&METADATA_DIR,
			&SEEDS_DIR,
			&EMAILS_DIR,
		},
		Files: []*string{
			&CONFIG_PATH,
			&ENV_FILE,
			&GITIGNORE,
			&INFO_PATH,
		},
	}
}

// Updates the directory paths in all variables
func UpdateLocations(old, new string) {

	//  Add all locations to the list
	//  including non-mandatory ones
	payload := append(LOCATIONS.Directories, []*string{
		&API_DIR,
		&GIT_DIR,
		&NODE_MODULES_PATH,
		&WEB_DIR,
	}...)

	for _, item := range payload {
		*item = strings.ReplaceAll(*item, old, new)
	}

	for _, item := range LOCATIONS.Files {
		*item = strings.ReplaceAll(*item, old, new)
	}
}
