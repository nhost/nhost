package metadata

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// ErrUnresolvedEnvVars is returned by [EnvString.Resolve] when one or more
// referenced environment variables are not set.
var ErrUnresolvedEnvVars = errors.New("unresolved environment variables")

// envVarPattern matches {{VAR_NAME}} patterns in strings.
var envVarPattern = regexp.MustCompile(`\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}`)

// EnvString is a string type that supports {{VAR_NAME}} interpolation against
// os.LookupEnv. Use Resolve to get the interpolated value and an error listing
// any variables that weren't set in the environment.
type EnvString string

// Resolve returns the string with {{VAR_NAME}} patterns replaced by environment
// variable values. Patterns whose variable is not set are left literal in the
// result; the returned error names every such variable so callers can decide
// whether to fail or proceed with the partial value.
func (e EnvString) Resolve() (string, error) {
	var missing []string

	out := envVarPattern.ReplaceAllStringFunc(string(e), func(match string) string {
		varName := match[2 : len(match)-2]
		if value, exists := os.LookupEnv(varName); exists {
			return value
		}

		missing = append(missing, varName)

		return match
	})

	if len(missing) > 0 {
		return out, fmt.Errorf("%w: %s", ErrUnresolvedEnvVars, strings.Join(missing, ", "))
	}

	return out, nil
}
