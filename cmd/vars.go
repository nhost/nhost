package cmd

import (
	"os"
	"path"

	"github.com/sirupsen/logrus"
)

var (
	// Utility build version
	Version string

	cfgFile string
	log     = logrus.New()
	DEBUG   bool
	JSON    bool

	LOG_FILE = ""

	// fetch current working directory
	workingDir, _ = os.Getwd()
	nhostDir      = path.Join(workingDir, "nhost")
	dotNhost      = path.Join(workingDir, ".nhost")

	// find user's home directory
	home, _ = os.UserHomeDir()

	// generate Nhost root directory for HOME
	NHOST_DIR = path.Join(home, ".nhost")

	// generate authentication file location
	authPath = path.Join(NHOST_DIR, "auth.json")

	// generate path for migrations
	migrationsDir = path.Join(nhostDir, "migrations")

	// generate path for metadata
	metadataDir = path.Join(nhostDir, "metadata")

	// generate path for frontend
	webDir = path.Join(nhostDir, "web")

	// generate path for API code
	apiDir = path.Join(nhostDir, "api")

	// generate path for .env.development
	envFile = path.Join(workingDir, ".env.development")

	// store Hasura console session command,
	// to kill it later while shutting down dev environment
	hasuraConsoleSpawnProcess *os.Process
)
