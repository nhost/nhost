package cmd

import (
	"context"
	"io/fs"
	"net/http"
	"plugin"

	"github.com/docker/docker/client"
	"github.com/go-git/go-git/v5"
	"github.com/mrinalwahal/cli/hasura"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
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

	WatcherOperation func(cmd *cobra.Command, args []string) error

	Environment struct {
		Name       string
		Active     bool
		Cancel     context.CancelFunc
		Port       int
		HTTP       *http.Client
		Hasura     *hasura.Client
		Docker     *client.Client
		Config     nhost.Configuration
		Context    context.Context
		Network    string
		Repository *git.Repository
		Branch     string

		// In the following format:
		// Key - Absolute File Name to Watch
		// Value - Function to execute,
		// which takes cobra command and suuplied arguments as params
		Watchers map[string]WatcherOperation
	}
)
