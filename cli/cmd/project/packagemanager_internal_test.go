package project

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"strings"
	"testing"

	"github.com/nhost/nhost/templates"
	"github.com/urfave/cli/v3"
)

// npm is the one manager that needs `run` in front of a script and not in
// front of install, and yarn installs with no subcommand at all. Getting
// either wrong ships documentation whose commands do not work.
func TestPackageManagerCommand(t *testing.T) {
	t.Parallel()

	tests := []struct {
		manager     string
		wantInstall string
		wantDev     string
	}{
		{manager: "pnpm", wantInstall: "pnpm install", wantDev: "pnpm dev"},
		{manager: "bun", wantInstall: "bun install", wantDev: "bun dev"},
		{manager: "yarn", wantInstall: "yarn", wantDev: "yarn dev"},
		{manager: "npm", wantInstall: "npm install", wantDev: "npm run dev"},
	}

	for _, tt := range tests {
		t.Run(tt.manager, func(t *testing.T) {
			t.Parallel()

			pm, ok := lookupPackageManager(tt.manager)
			if !ok {
				t.Fatalf("lookupPackageManager(%q) not found", tt.manager)
			}

			if got := pm.command("install"); got != tt.wantInstall {
				t.Errorf("command(install) = %q, want %q", got, tt.wantInstall)
			}

			if got := pm.command("dev"); got != tt.wantDev {
				t.Errorf("command(dev) = %q, want %q", got, tt.wantDev)
			}
		})
	}
}

func TestRetargetDocs(t *testing.T) {
	t.Parallel()

	const doc = "You need Node 22+, pnpm and a backend.\n" +
		"```sh\npnpm install\npnpm dev\npnpm build\n```\n"

	tests := []struct {
		manager  string
		wantAll  []string
		wantNone []string
	}{
		{
			manager:  "pnpm",
			wantAll:  []string{"pnpm install", "pnpm dev", "Node 22+, pnpm and"},
			wantNone: nil,
		},
		{
			manager:  "npm",
			wantAll:  []string{"npm install", "npm run dev", "npm run build", "Node 22+, npm and"},
			wantNone: []string{"pnpm"},
		},
		{
			manager:  "yarn",
			wantAll:  []string{"\nyarn\n", "yarn dev", "Node 22+, yarn and"},
			wantNone: []string{"pnpm"},
		},
		{
			manager:  "bun",
			wantAll:  []string{"bun install", "bun dev", "Node 22+, bun and"},
			wantNone: []string{"pnpm"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.manager, func(t *testing.T) {
			t.Parallel()

			pm, ok := lookupPackageManager(tt.manager)
			if !ok {
				t.Fatalf("lookupPackageManager(%q) not found", tt.manager)
			}

			got := string(retargetDocs([]byte(doc), pm))

			for _, want := range tt.wantAll {
				if !strings.Contains(got, want) {
					t.Errorf("rewritten doc is missing %q:\n%s", want, got)
				}
			}

			for _, unwanted := range tt.wantNone {
				if strings.Contains(got, unwanted) {
					t.Errorf("rewritten doc still mentions %q:\n%s", unwanted, got)
				}
			}
		})
	}
}

// The default has to be a no-op, or the template's own documentation would be
// rewritten into something it already says.
func TestRetargetDocsLeavesTheDefaultAlone(t *testing.T) {
	t.Parallel()

	pm, _ := lookupPackageManager(defaultPackageManager)

	const doc = "pnpm install && pnpm dev\n"

	if got := string(retargetDocs([]byte(doc), pm)); got != doc {
		t.Errorf("the default rewrote its own docs: %q", got)
	}
}

// Every script the shipped docs name has to be one the rewrite knows about, or
// a project scaffolded for npm is told to run a command without `run`.
func TestEveryDocumentedScriptIsRewritten(t *testing.T) {
	t.Parallel()

	npm, _ := lookupPackageManager("npm")

	for _, tmpl := range catalogue() {
		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			err := fs.WalkDir(
				templates.FS,
				tmpl.name,
				func(p string, d fs.DirEntry, err error) error {
					if err != nil || d.IsDir() || path.Ext(p) != ".md" {
						return err
					}

					data, err := fs.ReadFile(templates.FS, p)
					if err != nil {
						return fmt.Errorf("reading %s: %w", p, err)
					}

					if left := bytes.Count(
						retargetDocs(data, npm),
						[]byte(defaultPackageManager),
					); left != 0 {
						t.Errorf(
							"%s still names %s %d times after the rewrite",
							p,
							defaultPackageManager,
							left,
						)
					}

					return nil
				},
			)
			if err != nil {
				t.Fatalf("walking %s: %v", tmpl.name, err)
			}
		})
	}
}

// A file only one manager understands has to be one the template ships, or the
// scaffold quietly skips nothing.
func TestPackageManagerDropsAreShipped(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		for _, pm := range packageManagers() {
			for _, drop := range pm.drops {
				t.Run(tmpl.name+"/"+pm.name+"/"+drop, func(t *testing.T) {
					t.Parallel()

					if _, err := fs.Stat(templates.FS, path.Join(tmpl.name, drop)); err != nil {
						t.Errorf(
							"%s drops %s, which the template does not ship: %v",
							pm.name,
							drop,
							err,
						)
					}
				})
			}
		}
	}
}

func resolvePMWith(t *testing.T, template string, args ...string) (packageManager, error) {
	t.Helper()

	var (
		got    packageManager
		gotErr error
		output bytes.Buffer
	)

	cmd := &cli.Command{
		Name:  "init",
		Flags: []cli.Flag{&cli.StringFlag{Name: flagPackageManager, Value: defaultPackageManager}},
		Action: func(_ context.Context, c *cli.Command) error {
			got, gotErr = resolvePackageManager(newTestEnv(&output), c, template, false)

			return nil
		},
	}

	if err := cmd.Run(t.Context(), append([]string{"init"}, args...)); err != nil {
		t.Fatalf("parsing %q: %v", args, err)
	}

	return got, gotErr
}

func TestResolvePackageManager(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		template string
		args     []string
		want     string
		wantErr  error
	}{
		{name: "default", template: "nextjs", want: defaultPackageManager},
		{
			name:     "named",
			template: "nextjs",
			args:     []string{"--package-manager", "bun"},
			want:     "bun",
		},
		{
			name:     "unknown",
			template: "nextjs",
			args:     []string{"--package-manager", "cargo"},
			wantErr:  errUnknownPackageManager,
		},
		{
			name:     "without a template",
			template: "",
			args:     []string{"--package-manager", "bun"},
			wantErr:  errPackageManagerNeedsTmpl,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolvePMWith(t, tt.template, tt.args...)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("resolvePackageManager error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantErr == nil && got.name != tt.want {
				t.Errorf("resolvePackageManager = %q, want %q", got.name, tt.want)
			}
		})
	}
}
