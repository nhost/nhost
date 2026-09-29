package config

import (
	"bytes"
	"io"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/pelletier/go-toml/v2"
)

func TestCommandExample(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer

	cmd := CommandExample()
	cmd.Writer = &stdout
	cmd.ErrWriter = io.Discard

	if err := commandExample(t.Context(), cmd); err != nil {
		t.Fatalf("commandExample() error = %v", err)
	}

	if stdout.Len() == 0 {
		t.Fatal("commandExample() produced no output")
	}

	var cfg model.ConfigConfig
	if err := toml.Unmarshal(stdout.Bytes(), &cfg); err != nil {
		t.Fatalf("unmarshal commandExample() output: %v", err)
	}

	sch, err := schema.New()
	if err != nil {
		t.Fatalf("schema.New() error = %v", err)
	}

	if err := sch.ValidateConfig(cfg); err != nil {
		t.Fatalf("commandExample() output validation error = %v", err)
	}
}
