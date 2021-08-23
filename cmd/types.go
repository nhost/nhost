package cmd

import (
	"io/fs"
	"net/http"
	"plugin"
)

type (

	// Container service
	Container struct {
		Image               string
		Name                string
		Command             []string
		Entrypoint          string
		Environment         map[string]interface{}
		Ports               []string
		Restart             string
		User                string
		Volumes             []string
		DependsOn           []string `yaml:"depends_on,omitempty"`
		EnvFile             []string `yaml:"env_file,omitempty"`
		Build               map[string]string
		HealthCheckEndpoint string
	}

	/*
		// Container services
		Services struct {
			Containers map[string]Container `yaml:"services,omitempty"`
			Version    string
		}
	*/

	ExecResult struct {
		StdOut   string
		StdErr   string
		ExitCode int
	}

	Function struct {
		Route        string
		File         fs.FileInfo
		Path         string
		Handler      func(http.ResponseWriter, *http.Request)
		Base         string
		Name         string
		Build        string
		ServerConfig string
		Plugin       *plugin.Plugin
	}
)
