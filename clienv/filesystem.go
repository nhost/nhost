package clienv

import (
	"os"
	"path/filepath"
)

type PathStructure struct {
	root            string
	dotNhostFolder  string
	dataFolder      string
	functionsFolder string
	nhostFolder     string
}

func NewPathStructure(
	root, dotNhostFolder, dataFolder, functionsFolder, nhostFolder string,
) *PathStructure {
	return &PathStructure{
		root:            root,
		dotNhostFolder:  dotNhostFolder,
		dataFolder:      dataFolder,
		functionsFolder: functionsFolder,
		nhostFolder:     nhostFolder,
	}
}

func (p PathStructure) Root() string {
	return p.root
}

func (p PathStructure) DotNhostFolder() string {
	return p.dotNhostFolder
}

func (p PathStructure) DataFolder() string {
	return p.dataFolder
}

func (p PathStructure) FunctionsFolder() string {
	return p.functionsFolder
}

func (p PathStructure) NhostFolder() string {
	return p.nhostFolder
}

func (p PathStructure) AuthFile() string {
	return filepath.Join(PathStateHome(), "auth.json")
}

func (p PathStructure) NhostToml() string {
	return filepath.Join(p.nhostFolder, "nhost.toml")
}

func (p PathStructure) Secrets() string {
	return filepath.Join(p.root, ".secrets")
}

func (p PathStructure) HasuraConfig() string {
	return filepath.Join(p.nhostFolder, "config.yaml")
}

func (p PathStructure) ProjectFile() string {
	return filepath.Join(p.dotNhostFolder, "project.json")
}

func (p PathStructure) DockerCompose() string {
	return filepath.Join(p.dotNhostFolder, "docker-compose.yaml")
}

func PathExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
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
