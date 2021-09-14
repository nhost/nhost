package functions

var (

	// vars to store server state during each runtime
	functions []Function
	buildDir  string

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
