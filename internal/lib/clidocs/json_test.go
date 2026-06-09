package clidocs_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/clidocs"
	"github.com/urfave/cli/v3"
)

func TestToJSON(t *testing.T) {
	t.Parallel()

	root := &cli.Command{ //nolint:exhaustruct
		Name:        "demo",
		Usage:       "demo cli",
		Description: "a demo",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    "name",
				Aliases: []string{"n"},
				Usage:   "user name",
				Value:   "alice",
				Sources: cli.EnvVars("DEMO_NAME"),
			},
			&cli.IntFlag{ //nolint:exhaustruct
				Name:     "count",
				Required: true,
				Value:    3,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name: "verbose",
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:  "tags",
				Value: []string{"a", "b"},
			},
			&cli.DurationFlag{ //nolint:exhaustruct
				Name:  "timeout",
				Value: 5 * time.Second,
			},
			&cli.FloatFlag{ //nolint:exhaustruct
				Name: "ratio",
			},
		},
		Commands: []*cli.Command{
			{ //nolint:exhaustruct
				Name:  "sub",
				Usage: "sub cmd",
				Arguments: []cli.Argument{
					&cli.StringArg{Name: "path"}, //nolint:exhaustruct
				},
			},
			{ //nolint:exhaustruct
				Name:   "hidden-cmd",
				Hidden: true,
			},
		},
	}

	b, err := clidocs.ToJSON(root)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var got clidocs.CmdJSON
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, b)
	}

	if got.Name != "demo" {
		t.Errorf("name = %q", got.Name)
	}

	flagBy := map[string]clidocs.FlagJSON{}
	for _, f := range got.Flags {
		flagBy[f.Name] = f
	}

	cases := []struct {
		flag, want, item string
	}{
		{"name", "string", ""},
		{"count", "integer", ""},
		{"verbose", "boolean", ""},
		{"tags", "array", "string"},
		{"timeout", "duration", ""},
		{"ratio", "number", ""},
	}
	for _, c := range cases {
		f, ok := flagBy[c.flag]
		if !ok {
			t.Errorf("missing flag %q", c.flag)
			continue
		}
		if f.Type != c.want {
			t.Errorf("flag %q: type = %q, want %q", c.flag, f.Type, c.want)
		}
		if f.ItemType != c.item {
			t.Errorf("flag %q: itemType = %q, want %q", c.flag, f.ItemType, c.item)
		}
	}

	if !flagBy["count"].Required {
		t.Errorf("count should be required")
	}
	if flagBy["name"].Default != "alice" {
		t.Errorf("name default = %v", flagBy["name"].Default)
	}
	if len(flagBy["name"].EnvVars) != 1 || flagBy["name"].EnvVars[0] != "DEMO_NAME" {
		t.Errorf("name envVars = %v", flagBy["name"].EnvVars)
	}

	if len(got.Commands) != 1 || got.Commands[0].Name != "sub" {
		t.Fatalf("expected only visible 'sub' subcommand, got %+v", got.Commands)
	}
	if len(got.Commands[0].Args) != 1 || got.Commands[0].Args[0].Name != "path" {
		t.Errorf("sub args = %+v", got.Commands[0].Args)
	}
}
