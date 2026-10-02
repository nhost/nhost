package agents

import (
	"os"
	"strings"
)

const secretEnvPrefix = "AI_AGENT_SECRET_"

// resolveSecret resolves a secret reference to its actual value. The second
// return value reports whether the reference is considered "configured":
//   - "env:VAR_NAME" — looks up AI_AGENT_SECRET_VAR_NAME. Returns
//     (value, true) if the variable is set (even to the empty string), or
//     ("", false) if it is not set at all. Restricting to this prefix
//     prevents leaking unrelated environment variables.
//   - any other string — returned as-is with ok=true.
//
// Distinguishing "not set" from "set to empty" lets callers fail loudly on
// misconfiguration instead of silently propagating an empty secret.
func resolveSecret(value string) (string, bool) {
	if name, ok := strings.CutPrefix(value, "env:"); ok {
		return os.LookupEnv(secretEnvPrefix + name)
	}

	return value, true
}
