package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"testing"
)

var firstRunDevTest = test{
	name: "first-run",
	prerun: func() error {

		os.Args = append(os.Args, "dev")

		// Don't open browser windows
		devCmd.Flag("no-browser").Value.Set("true")

		return nil
	},
	operation: func() error {

		//  Initialize the runtime environment
		if err := env.Init(); err != nil {
			return err
		}

		if err := env.Config.Wrap(); err != nil {
			return err
		}

		env.ExecutionContext, env.ExecutionCancel = context.WithCancel(env.Context)

		if err := env.Execute(); err != nil {
			return err
		}

		return nil
	},
	validator: pathsCreated,
}

var cleanupTest = test{
	name: "cleanup",
	operation: func() error {

		//	First, initiate the cleanup
		env.Cleanup()

		return nil
	},
	validator: func() error {

		//  Fetch list of containers and ensure they are all stopped
		env.Context, env.Cancel = context.WithCancel(context.Background())
		containers, err := env.GetContainers()
		if err != nil {
			return err
		}

		if len(containers) > 0 {
			return fmt.Errorf("Expected no containers, got %d", len(containers))
		}

		//  Make HTTP requests to ensure reverse proxy has stopped.
		if _, err := call(fmt.Sprintf("http://localhost:" + env.Port)); err == nil {
			return fmt.Errorf("Expected reverse proxy to be stopped, but it returned no error")
		}

		env.Context.Done()

		return nil
	},
}

var healthTest = test{
	name:      "health",
	validator: healthCheck,
}

func Test_Pipeline(t *testing.T) {

	InitTests(t)

	tests := []test{
		newLocalAppTest,
		firstRunDevTest,
		healthTest,
		jsFunctionTestWithServer,
		goFunctionTestWithServer,
		cleanupTest,
	}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}

	//	Delete the temporary directory for tests
	deletePaths()
}

func healthCheck() error {

	for _, item := range env.Config.Services {
		if item.HealthEndpoint != "" {
			if code := check200(item.Address + item.HealthEndpoint); code != 200 {
				return fmt.Errorf("%s: expected 200 response, got - %v", item.Name, code)
			}
		}
	}

	return nil
}

//	Performs a basic ping request and returns status code.
func check200(url string) int {

	resp, err := http.Get(url)
	if err != nil {
		return 0
	}

	return resp.StatusCode
}

//	Performs a basic ping request and returns response body.
func call(url string) (string, error) {

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}
