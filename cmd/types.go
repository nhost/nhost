package cmd

import (
	"context"
	"io/fs"
	"net/http"
	"plugin"
	"sync"

	"github.com/docker/docker/client"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
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
		Build        string
		ServerConfig string
		Plugin       *plugin.Plugin
	}

	WatcherOperation func() error

	Environment struct {
		sync.Mutex

		Name string

		// Records the current state of the environment
		state State

		//	Channel in which state changes are updated for listeners
		//	stateChan chan State

		// List of all HTTP servers registered with our environment.
		Servers []*http.Server

		// Parent cancellable context
		Context context.Context
		Cancel  context.CancelFunc

		// Execution specific cancellable context
		ExecutionContext context.Context
		ExecutionCancel  context.CancelFunc

		Port string
		// HTTP       *http.Client
		Hasura  *hasura.Client
		Docker  *client.Client
		Config  nhost.Configuration
		Network string
		// Repository *git.Repository
		// Branch string

		// In the following format:
		// Key - Absolute File Name to Watch
		// Value - Function to execute,
		// which takes cobra command and suuplied arguments as params
		Watchers map[string]WatcherOperation
	}
)
