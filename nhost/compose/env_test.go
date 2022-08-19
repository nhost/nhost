package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_env_mergeWithServiceEnv(t *testing.T) {
	assert := assert.New(t)

	e := env{"A": "B"}
	e.mergeWithServiceEnv(map[string]interface{}{"A": "C", "B": "D", "small": "bIG"})
	assert.Equal(env{"A": "C", "B": "D", "SMALL": "bIG"}, e)
}

func Test_env_mergeWithConfigEnv(t *testing.T) {
	assert := assert.New(t)

	e := env{"A": "B"}
	e.mergeWithConfigEnv(map[interface{}]interface{}{"A": "C", "B": "D", "small": "bIG"}, "SVC")
	assert.Equal(env{"A": "B", "SVC_B": "D", "SVC_A": "C", "SVC_SMALL": "bIG"}, e)
}

func Test_env_mergeWithSlice(t *testing.T) {
	assert := assert.New(t)

	e := env{"A": "B"}
	e.mergeWithConfigEnv(map[interface{}]interface{}{"A": "C", "B": "D", "small": "bIG"}, "SVC")
	assert.Equal(env{"A": "B", "SVC_B": "D", "SVC_A": "C", "SVC_SMALL": "bIG"}, e)
}

func Test_env_dockerServiceConfigEnv(t *testing.T) {
	assert := assert.New(t)

	e := env{"A": "B", "C": "D"}
	assert.Equal(types.NewMappingWithEquals([]string{"A=B", "C=D"}), e.dockerServiceConfigEnv())
}
