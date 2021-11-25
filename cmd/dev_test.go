package cmd

import (
	"context"
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
	postrun: func() error {

		//	Cleanup
		env.Cleanup()

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

func Test_Pipeline(t *testing.T) {

	InitTests(t)

	tests := []test{
		newLocalAppTest,
		firstRunDevTest,
	}

	//	Run tests
	for _, tt := range tests {
		tt.run(t)
	}
}
