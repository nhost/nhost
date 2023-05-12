package system

import (
	"os"
	"path/filepath"
)

func PathProject() string {
	return filepath.Join(PathDotNhost(), "project.json")
}

func PathAuthFile() string {
	return filepath.Join(PathStateHome(), "auth.json")
}

func PathNhost() string {
	return "nhost"
}

func PathHasura() string {
	return filepath.Join(PathNhost(), "config.yaml")
}

func PathConfig() string {
	return filepath.Join(PathNhost(), "nhost.toml")
}

func PathSecrets() string {
	return ".secrets"
}

func PathExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

func PathDotNhost() string {
	return ".nhost"
}

func PathStateHome() string {
	var path string
	if os.Getenv("XDG_STATE_HOME") != "" {
		path = filepath.Join(os.Getenv("XDG_STATE_HOME"), "nhost")
	} else {
		path = filepath.Join(os.Getenv("HOME"), ".nhost", "state")
	}

	return path
}
