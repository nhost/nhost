package ports

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func makeTestPorts() *Ports {
	return NewPorts(1, 2, 3, 4, 5, 6, 7, 8)
}

func TestNewPorts(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.p, map[string]uint32{
		FlagPortProxy:            1,
		FlagPortDB:               2,
		FlagPortGraphQL:          3,
		FlagPortHasuraConsole:    4,
		FlagPortHasuraConsoleAPI: 5,
		FlagPortSMTP:             6,
		FlagPortMinioS3:          7,
		FlagPortMailhog:          8,
	})
}

func TestPorts_Proxy(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.Proxy(), uint32(1))
}

func TestPorts_DB(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.DB(), uint32(2))
}

func TestPorts_GraphQL(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.GraphQL(), uint32(3))
}

func TestPorts_HasuraConsole(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.HasuraConsole(), uint32(4))
}

func TestPorts_HasuraConsoleAPI(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.HasuraConsoleAPI(), uint32(5))
}

func TestPorts_SMTP(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.SMTP(), uint32(6))
}

func TestPorts_MinioS3(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.MinioS3(), uint32(7))
}

func TestPorts_Mailhog(t *testing.T) {
	p := makeTestPorts()
	assert.Equal(t, p.Mailhog(), uint32(8))
}
