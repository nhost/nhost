package cmd

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_uiType_IsHasura(t *testing.T) {
	assert := assert.New(t)

	assert.True(uiTypeHasura.IsHasura())
}

func Test_uiType_IsNhost(t *testing.T) {
	assert := assert.New(t)

	assert.True(uiTypeNhost.IsNhost())
}

func Test_uiType_String(t *testing.T) {
	assert := assert.New(t)

	assert.Equal(uiType("foobar").String(), "foobar")
}
