package serve_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

// echoPath reports the path the handler was reached with, so a test can tell
// whether a mount prefix was stripped before dispatch.
func echoPath(body string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, body+":"+r.URL.Path)
	})
}

func mounted(name, prefix string, handler http.Handler) serveutil.Mounted {
	return serveutil.Mounted{
		Name:    name,
		Prefix:  prefix,
		Service: &serveutil.Service{Handler: handler, Background: nil, Close: nil},
	}
}

func TestMountByPrefixRoutes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		services []serveutil.Mounted
		target   string
		want     string
	}{
		{
			name:     "single service at the empty prefix is served directly",
			services: []serveutil.Mounted{mounted("auth", "", echoPath("auth"))},
			target:   "/v1/signin",
			want:     "auth:/v1/signin",
		},
		{
			name: "mounted service is reached with its prefix stripped",
			services: []serveutil.Mounted{
				mounted("auth", "/auth", echoPath("auth")),
				mounted("storage", "/storage", echoPath("storage")),
			},
			target: "/storage/v1/files",
			want:   "storage:/v1/files",
		},
		{
			name:     "single service keeps its prefix when it declares one",
			services: []serveutil.Mounted{mounted("auth", "/auth", echoPath("auth"))},
			target:   "/auth/v1/signin",
			want:     "auth:/v1/signin",
		},
		{
			name: "service without a handler is skipped",
			services: []serveutil.Mounted{
				{
					Name:    "worker",
					Prefix:  "",
					Service: &serveutil.Service{Handler: nil, Background: nil, Close: nil},
				},
				mounted("auth", "", echoPath("auth")),
			},
			target: "/v1/signin",
			want:   "auth:/v1/signin",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			handler, err := serveutil.MountByPrefix(tt.services)
			if err != nil {
				t.Fatalf("MountByPrefix() err = %v; want nil", err)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.target, nil))

			if got := rec.Body.String(); got != tt.want {
				t.Errorf("response body = %q; want %q", got, tt.want)
			}
		})
	}
}

func TestMountByPrefixRejectsUnmountableSets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		services []serveutil.Mounted
		wantErr  string
	}{
		{
			name:     "no handlers at all",
			services: nil,
			wantErr:  "no service defines a Handler",
		},
		{
			name: "composed service without a prefix",
			services: []serveutil.Mounted{
				mounted("auth", "", echoPath("auth")),
				mounted("storage", "/storage", echoPath("storage")),
			},
			wantErr: "a prefix is required",
		},
		{
			name: "prefix without a leading slash",
			services: []serveutil.Mounted{
				mounted("auth", "auth", echoPath("auth")),
				mounted("storage", "/storage", echoPath("storage")),
			},
			wantErr: "must start with",
		},
		{
			name: "prefix with a trailing slash",
			services: []serveutil.Mounted{
				mounted("auth", "/auth/", echoPath("auth")),
				mounted("storage", "/storage", echoPath("storage")),
			},
			wantErr: "must start with",
		},
		{
			name: "two services claiming the same prefix",
			services: []serveutil.Mounted{
				mounted("auth", "/auth", echoPath("auth")),
				mounted("other", "/auth", echoPath("other")),
			},
			wantErr: "duplicate mount prefix",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			handler, err := serveutil.MountByPrefix(tt.services)
			if err == nil {
				t.Fatalf("MountByPrefix() handler = %v, err = nil; want an error", handler)
			}

			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("MountByPrefix() err = %q; want it to contain %q", err, tt.wantErr)
			}
		})
	}
}
