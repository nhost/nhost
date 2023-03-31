package envvars_test

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost/envvars"
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_env_merge(t *testing.T) {
	assert := assert.New(t)

	e := envvars.Env{"A": "B"}
	e.Merge(envvars.Env{"C": "D", "D": "E"}, envvars.Env{"FOO": "BAR", "D": "F"})
	assert.Equal(envvars.Env{"A": "B", "C": "D", "D": "F", "FOO": "BAR"}, e)
}

func Test_env_ToDockerServiceConfigEnv(t *testing.T) {
	assert := assert.New(t)

	e := envvars.Env{"A": "B", "C": "D"}
	assert.Equal(types.NewMappingWithEquals([]string{"A=B", "C=D"}), e.ToDockerServiceConfigEnv())
}
