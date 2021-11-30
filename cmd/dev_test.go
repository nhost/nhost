package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"testing"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
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

		//	Validate environment variables
		if err := testRuntimeVars(env.Port, false); err != nil {
			return err
		}

		env.ExecutionContext, env.ExecutionCancel = context.WithCancel(env.Context)

		if err := env.Execute(); err != nil {
			return err
		}

		//	Ensure required number of containers have been launched
		//
		//	Since, we are already performing multiple health checks, we can
		//	safely just fetch the number of running containers.
		containers, err := env.GetContainers()
		if err != nil {
			return err
		}

		if len(containers) != len(env.Config.Services) {
			return fmt.Errorf("expected %d containers, got %d", len(env.Config.Services), len(containers))
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

	//	Take ownership of minio location before removing temp dir
	//	file := filepath.Join(nhost.DOT_NHOST, "minio", "data")
	if output, err := exec.Command("sudo", "rm", "-rf", nhost.DOT_NHOST).CombinedOutput(); err != nil {
		t.Error(string(output))
		t.Errorf("Failed to remove temp dir: %v", err)
	}

	/*
			//	Might as well not even bother deleting the temporary directory

			//	Delete the temporary directory for tests
		   	if err := deletePaths(); err != nil {

		   		//	Directory ownership permission error is already known with Minio.
		   		//	TempDir RemoveAll cleanup: unlinkat /tmp/Test_Pipeline3097199488/001/test/.nhost/main/minio/data/.minio.sys/buckets/.tracker.bin: permission denied
		   		//	So, ignore this error.

		   		if !errors.Is(err, os.ErrPermission) {
		   			t.Error(err)
		   		}
		   	}
	*/
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

func testRuntimeVars(port string, network bool) error {

	payload := util.RuntimeVars(port, network)

	for name, item := range payload {
		switch name {
		case "HASURA_GRAPHQL_ADMIN_SECRET":
			if item != util.ADMIN_SECRET {
				return errors.New("HASURA_GRAPHQL_ADMIN_SECRET is incorrect")
			}
		case "NHOST_ADMIN_SECRET":
			if item != util.ADMIN_SECRET {
				return errors.New("NHOST_ADMIN_SECRET is incorrect")
			}
		case "HASURA_GRAPHQL_JWT_SECRET":
			if item != fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, util.JWT_KEY) {
				return errors.New("HASURA_GRAPHQL_JWT_SECRET is incorrect")
			}
		case "NHOST_JWT_SECRET":
			if item != fmt.Sprintf(`{"type":"HS256", "key": "%v"}`, util.JWT_KEY) {
				return errors.New("NHOST_JWT_SECRET is incorrect")
			}
		case "NHOST_BACKEND_URL":
			if item != fmt.Sprintf(`http://localhost:%v`, port) {
				return errors.New("NHOST_BACKEND_URL is incorrect")
			}
		case "NHOST_WEBHOOK_SECRET":
			if item != util.WEBHOOK_SECRET {
				return errors.New("NHOST_WEBHOOK_SECRET is incorrect")
			}
		}
	}

	return nil
}
