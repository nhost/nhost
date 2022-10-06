package nhost

import (
	"github.com/stretchr/testify/assert"
	"strings"
	"testing"
)

func Test_randomProjectName(t *testing.T) {
	assert := assert.New(t)

	assert.True(strings.HasPrefix(randomProjectName("test"), "test-"))
	assert.True(strings.HasPrefix(randomProjectName("cookie monster (RAM)"), "cookie-monster-ram-"))
	assert.True(strings.HasPrefix(randomProjectName("foo        + +    bar"), "foo-bar-"))
	assert.True(strings.HasPrefix(randomProjectName("____bla-- bla _  2389 blaaaa ___"), "bla---bla-_-2389-blaaaa-"))
}
