package nhost

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
)

var (
	log    = &logger.Log
	status = &util.Writer
	DOMAIN = "nhost.run"
	API    = fmt.Sprintf("https://%s/v1/functions", DOMAIN)

	//  fetch current working directory
	NHOST_DIR string
	DOT_NHOST string

	//  initialize the names of all Nhost services in the stack
	SERVICES []string

	//  find user's home directory
	HOME, _ = os.UserHomeDir()

	//  Nhost root directory for HOME
	ROOT = filepath.Join(HOME, ".nhost")

	//  authentication file location
	AUTH_PATH = filepath.Join(ROOT, "auth.json")

	//  path for migrations
	MIGRATIONS_DIR string

	//  path for metadata
	METADATA_DIR string

	//  default Nhost database
	DATABASE = "default"

	//  path for seeds
	SEEDS_DIR string

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
	REMOTE = "origin"

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
	REPOSITORY = "nhost/cli"

	//  initialize the project prefix
	PREFIX = "nhost"

	//	mandatorily required locations
	LOCATIONS Required
)

//	Initialize Nhost variables for runtime
func Init() {

	//  fetch current working directory
	if NHOST_DIR == "" {
		NHOST_DIR = filepath.Join(util.WORKING_DIR, "nhost")
	}

	if DOT_NHOST == "" {
		DOT_NHOST, _ = GetDotNhost()
	}

	//  initialize the names of all Nhost services in the stack
	if SERVICES == nil {
		SERVICES = []string{"hasura", "auth", "storage", "mailhog", "postgres", "minio"}
	}

	//  path for migrations
	if MIGRATIONS_DIR == "" {
		MIGRATIONS_DIR = filepath.Join(NHOST_DIR, "migrations")
	}

	//  path for metadata
	if METADATA_DIR == "" {
		METADATA_DIR = filepath.Join(NHOST_DIR, "metadata")
	}

	//  path for seeds
	if SEEDS_DIR == "" {
		SEEDS_DIR = filepath.Join(NHOST_DIR, "seeds")
	}

	//  path for frontend
	if WEB_DIR == "" {
		WEB_DIR = filepath.Join(util.WORKING_DIR, "web")
	}

	//  path for API code
	if API_DIR == "" {
		API_DIR = filepath.Join(util.WORKING_DIR, "functions")
	}

	//  path for email templates
	if EMAILS_DIR == "" {
		EMAILS_DIR = filepath.Join(NHOST_DIR, "emails")
	}

	//  path for legacy migrations
	if LEGACY_DIR == "" {
		LEGACY_DIR = filepath.Join(DOT_NHOST, "legacy")
	}

	//  path for local git directory
	if GIT_DIR == "" {
		GIT_DIR = filepath.Join(util.WORKING_DIR, ".git")
	}

	//  path for .env.development
	if ENV_FILE == "" {
		ENV_FILE = filepath.Join(util.WORKING_DIR, ".env.development")
	}

	//  path for .config.yaml file
	if CONFIG_PATH == "" {
		CONFIG_PATH = filepath.Join(NHOST_DIR, "config.yaml")
	}

	//  path for .gitignore file
	if GITIGNORE == "" {
		GITIGNORE = filepath.Join(util.WORKING_DIR, ".gitignore")
	}

	//  path for .nhost/nhost.yaml file
	if INFO_PATH == "" {
		INFO_PATH = filepath.Join(DOT_NHOST, "nhost.yaml")
	}

	//  path for express NPM modules
	if NODE_MODULES_PATH == "" {
		NODE_MODULES_PATH = filepath.Join(ROOT, "node_modules")
	}

	//	mandatorily required locations
	LOCATIONS = Required{
		Directories: []*string{
			&ROOT,
			&NHOST_DIR,
			&MIGRATIONS_DIR,
			&METADATA_DIR,
			&SEEDS_DIR,
			&EMAILS_DIR,
			&DOT_NHOST,
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
