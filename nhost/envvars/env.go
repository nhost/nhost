package envvars

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
)

func New() Env {
	return Env{}
}

type Env map[string]string

func (e Env) Merge(otherEnv ...Env) Env {
	for _, e2 := range otherEnv {
		for k, v := range e2 {
			e[k] = v
		}
	}

	return e
}

func (e Env) ToDockerServiceConfigEnv() types.MappingWithEquals {
	out := []string{}

	for k, v := range e {
		out = append(out, fmt.Sprintf("%s=%s", k, v))
	}

	return types.NewMappingWithEquals(out)
}
