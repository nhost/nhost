package environment

import (
	"context"
	"net/http"
	"sync"

	client "github.com/docker/docker/client"
	"github.com/nhost/cli-go/hasura"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/watcher"
)

type (
	Environment struct {
		sync.Mutex

		Name string

		// Records the current state of the environment
		State State

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

		Port    string
		Hasura  *hasura.Client
		Docker  *client.Client
		Config  nhost.Configuration
		Network string

		Watcher *watcher.Watcher
	}
)
