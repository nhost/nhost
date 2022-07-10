package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"strings"
)

type env map[string]string

func (e env) mergeWithServiceEnv(m map[string]interface{}) {
	for k, v := range m {
		e[strings.ToUpper(k)] = fmt.Sprint(v)
	}
}

func (e env) merge(e2 env) {
	for k, v := range e2 {
		e[k] = v
	}
}

func (e env) mergeWithConfigEnv(m map[interface{}]interface{}, prefix string) {
	envs := nhost.ParseEnvVarsFromConfig(m, prefix)
	for _, v := range envs {
		// split the env var into key and value
		parts := strings.SplitN(v, "=", 2)
		if len(parts) == 2 {
			e[parts[0]] = parts[1]
		}
	}
}

func (e env) mergeWithSlice(s []string) {
	for _, v := range s {
		// split the env var into key and value
		parts := strings.SplitN(v, "=", 2)
		if len(parts) == 2 {
			e[parts[0]] = parts[1]
		} else if len(parts) == 1 {
			e[parts[0]] = ""
		}
	}
}

func (e env) dockerServiceConfigEnv() types.MappingWithEquals {
	out := []string{}

	for k, v := range e {
		out = append(out, fmt.Sprintf("%s=%s", k, v))
	}

	return types.NewMappingWithEquals(out)
}
