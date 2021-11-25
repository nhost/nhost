package tests

import (
	"os"
	"testing"
)

func Test_DevCmd(t *testing.T) {

	tests := tests{firstRunDevTest}

	run(tests, t)
}

var firstRunDevTest = test{
	name: "first-run",
	prerun: func() {

		os.Args = append(os.Args, "dev")

		// Don't open browser windows
		devCmd.Flag("no-browser").Value.Set("true")

	},
	operation: devCmd.Execute,
	validator: pathsCreated,
}
