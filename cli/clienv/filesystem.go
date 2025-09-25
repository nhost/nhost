package clienv

import (
	"os"
	"path/filepath"
)

type PathStructure struct {
	workingDir     string
	root           string
	dotNhostFolder string
	nhostFolder    string
}

func NewPathStructure(
	workingDir, root, dotNhostFolder, nhostFolder string,
) *PathStructure {
	return &PathStructure{
		workingDir:     workingDir,
		root:           root,
		dotNhostFolder: dotNhostFolder,
		nhostFolder:    nhostFolder,
	}
}

func (p PathStructure) WorkingDir() string {
	return p.workingDir
}

func (p PathStructure) Root() string {
	return p.root
}

func (p PathStructure) DotNhostFolder() string {
	return p.dotNhostFolder
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

func (p PathStructure) OverlaysFolder() string {
	return filepath.Join(p.nhostFolder, "overlays")
}

func (p PathStructure) Overlay(subdomain string) string {
	return filepath.Join(p.OverlaysFolder(), subdomain+".json")
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

func (p PathStructure) Functions() string {
	return filepath.Join(p.root, "functions")
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

func (p PathStructure) RunServiceOverlaysFolder(configPath string) string {
	base := filepath.Dir(configPath)
	return filepath.Join(base, "nhost", "overlays")
}

func (p PathStructure) RunServiceOverlay(configPath, subdomain string) string {
	return filepath.Join(p.RunServiceOverlaysFolder(configPath), "run-"+subdomain+".json")
}
