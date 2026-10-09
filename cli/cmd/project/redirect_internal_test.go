package project

import (
	"encoding/json"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	nhostproject "github.com/nhost/nhost/cli/project"
	"github.com/nhost/nhost/templates"
	"github.com/pelletier/go-toml/v2"
)

// A native template comes back on the scheme in its app.json, so the backend
// init writes has to allow that scheme or no sign-in link works in a build.
// Expo Go's exp:// is allowed whole, so it must never be in the shared list a
// deployed project reads.
func TestRedirectURLsFollowTheAppScheme(t *testing.T) {
	t.Parallel()

	for _, tmpl := range catalogue() {
		t.Run(tmpl.name, func(t *testing.T) {
			t.Parallel()

			for _, u := range tmpl.redirectURLs {
				if strings.HasPrefix(u, "exp://") {
					t.Errorf(
						"%s is shared with deployed projects; it belongs in localRedirectURLs",
						u,
					)
				}
			}

			b, err := fs.ReadFile(templates.FS, path.Join(tmpl.name, "frontend", "app.json"))
			if err != nil {
				return
			}

			var app struct {
				Expo struct {
					Scheme string `json:"scheme"`
				} `json:"expo"`
			}

			if err := json.Unmarshal(b, &app); err != nil {
				t.Fatalf("parsing app.json: %v", err)
			}

			if want := app.Expo.Scheme + "://"; !slices.Contains(tmpl.redirectURLs, want) {
				t.Errorf("redirectURLs = %v, want %q from app.json", tmpl.redirectURLs, want)
			}
		})
	}
}

func TestAllowRedirects(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		allowed []string
		urls    []string
		want    []string
	}{
		{
			name:    "no urls leaves the list unset",
			allowed: nil,
			urls:    nil,
			want:    nil,
		},
		{
			name:    "adds to an empty list",
			allowed: nil,
			urls:    []string{"nhoststarter://"},
			want:    []string{"nhoststarter://"},
		},
		{
			name:    "keeps what is there and adds nothing twice",
			allowed: []string{"https://example.com", "nhoststarter://"},
			urls:    []string{"nhoststarter://"},
			want:    []string{"https://example.com", "nhoststarter://"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := &model.ConfigConfig{
				Auth: &model.ConfigAuth{
					Redirections: &model.ConfigAuthRedirections{
						ClientUrl:   nil,
						AllowedUrls: tt.allowed,
					},
				},
			}

			allowRedirects(tt.urls)(cfg)

			if got := cfg.Auth.Redirections.AllowedUrls; !slices.Equal(got, tt.want) {
				t.Errorf("allowedUrls = %v, want %v", got, tt.want)
			}
		})
	}
}

// The overlay appends to the list nhost.toml has, so the local backend allows
// both and nhost.toml carries only the shared entries.
func TestWriteLocalRedirects(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root, root, filepath.Join(root, ".nhost"), filepath.Join(root, "nhost"),
	)

	if err := os.MkdirAll(ps.NhostFolder(), 0o755); err != nil {
		t.Fatal(err)
	}

	cfg, err := nhostproject.DefaultConfig()
	if err != nil {
		t.Fatalf("DefaultConfig: %v", err)
	}

	allowRedirects([]string{"nhoststarter://"})(cfg)

	if err := clienv.MarshalFile(cfg, ps.NhostToml(), toml.Marshal); err != nil {
		t.Fatal(err)
	}

	if err := writeLocalRedirects(ps, []string{"exp://"}); err != nil {
		t.Fatalf("writeLocalRedirects: %v", err)
	}

	got, err := readLocalConfig(ps)
	if err != nil {
		t.Fatalf("readLocalConfig: %v", err)
	}

	want := []string{"nhoststarter://", "exp://"}
	if allowed := got.GetAuth().GetRedirections().GetAllowedUrls(); !slices.Equal(allowed, want) {
		t.Errorf("local allowedUrls = %v, want %v", allowed, want)
	}
}

func TestWriteLocalRedirectsWithNoURLsWritesNothing(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root, root, filepath.Join(root, ".nhost"), filepath.Join(root, "nhost"),
	)

	if err := writeLocalRedirects(ps, nil); err != nil {
		t.Fatalf("writeLocalRedirects: %v", err)
	}

	if _, err := os.Stat(ps.OverlaysFolder()); !os.IsNotExist(err) {
		t.Errorf("an overlay folder was created with nothing to put in it: %v", err)
	}
}

func TestMissingRedirects(t *testing.T) {
	t.Parallel()

	withAllowed := func(urls ...string) *model.ConfigConfig {
		return &model.ConfigConfig{
			Auth: &model.ConfigAuth{
				Redirections: &model.ConfigAuthRedirections{
					ClientUrl:   nil,
					AllowedUrls: urls,
				},
			},
		}
	}

	tests := []struct {
		name string
		urls []string
		cfg  *model.ConfigConfig
		want []string
	}{
		{
			name: "an unreadable config is missing everything",
			urls: []string{"nhoststarter://", "exp://"},
			cfg:  nil,
			want: []string{"nhoststarter://", "exp://"},
		},
		{
			name: "names only what is not allowed",
			urls: []string{"nhoststarter://", "exp://"},
			cfg:  withAllowed("https://example.com", "exp://"),
			want: []string{"nhoststarter://"},
		},
		{
			name: "nothing to allow names nothing",
			urls: nil,
			cfg:  nil,
			want: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := missingRedirects(tt.urls, tt.cfg); !slices.Equal(got, tt.want) {
				t.Errorf("missingRedirects = %v, want %v", got, tt.want)
			}
		})
	}
}
