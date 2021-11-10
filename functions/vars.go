package functions

import "github.com/nhost/cli/util"

var (

	//  vars to store server state during each runtime
	functions []Function

	//  initialize temporary directory for caching
	tempDir string

	//  runtime environment variables
	envVars []string

	status = &util.Writer

	defaultFilesToAvoid = []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
		"go.mod",
		"go.sum",
	}
)
