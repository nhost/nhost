package functions

var (

	// vars to store server state during each runtime
	functions []Function

	// initialize temporary directory for caching
	tempDir string

	// runtime environment variables
	envVars []string

	defaultFilesToAvoid = []string{
		"node_modules",
		"package.json",
		"package-lock.json",
		"yarn.lock",
		"go.mod",
		"go.sum",
	}
)
