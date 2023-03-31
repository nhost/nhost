package generichelper_test

import (
	"github.com/nhost/cli/internal/generichelper"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestPointerify(t *testing.T) {
	assert := assert.New(t)
	str := "string"
	assert.Equal(&str, generichelper.Pointerify(str))
}

func TestDerefPtr(t *testing.T) {
	assert := assert.New(t)
	str := "string"
	assert.Equal("string", generichelper.DerefPtr(&str))

	var nilStr *string
	assert.Equal("", generichelper.DerefPtr(nilStr))
}
