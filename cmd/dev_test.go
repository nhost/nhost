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

var healthTest = test{
	name:      "health",
	validator: healthCheck,
}

func Test_Pipeline(t *testing.T) {

	InitTests(t)

	/* 	nhost.API_DIR = filepath.Join(util.WORKING_DIR, "functions")
	   	buildDir = nhost.API_DIR

	   	//	Initialize a temporary directory to store test function files
	   	if err := os.MkdirAll(nhost.API_DIR, os.ModePerm); err != nil {
	   		t.Fatal(err)
	   	}
	*/

	tests := []test{
		newLocalAppTest,
		firstRunDevTest,
		healthTest,
		//	jsFunctionTest,
		//	goFunctionTest,
	}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}

	//	Cleanup
	env.Cleanup()
}

func healthCheck() error {

	for _, item := range env.Config.Services {
		if item.HealthEndpoint != "" {
			if code := check200(item.HealthEndpoint); code != 200 {
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
