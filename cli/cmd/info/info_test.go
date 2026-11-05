package info_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/info"
)

const (
	testPAT         = "test-pat"
	testAccessToken = "test-access-token"
	testUser        = `{
		"id": "1c8a47be-9915-4d78-9223-4b9ffcb2aec1",
		"displayName": "Jane Doe",
		"email": "jane@example.com"
	}`
	testProject = `{
		"id": "5f2d1e4a-8b7c-4d3e-9f1a-2b3c4d5e6f70",
		"name": "my-app",
		"subdomain": "abcdefghijklmnopqrst",
		"region": {"name": "eu-central-1"}
	}`
)

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body string) {
	t.Helper()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if _, err := w.Write([]byte(body)); err != nil {
		t.Errorf("failed to write response: %v", err)
	}
}

func newAuthServer(t *testing.T, userStatus int) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	mux.HandleFunc("POST /signin/pat", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(t, w, http.StatusOK, `{"session": {
			"accessToken": "`+testAccessToken+`",
			"accessTokenExpiresIn": 900
		}}`)
	})

	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+testAccessToken {
			writeJSON(t, w, http.StatusUnauthorized, `{"error": "invalid-token"}`)
			return
		}

		if userStatus != http.StatusOK {
			writeJSON(t, w, userStatus, `{"error": "unauthorized"}`)
			return
		}

		writeJSON(t, w, http.StatusOK, testUser)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	return srv
}

func TestCommand(t *testing.T) {
	t.Parallel()

	userSection := "User\n" +
		"  Name:      Jane Doe\n" +
		"  Email:     jane@example.com\n" +
		"  ID:        1c8a47be-9915-4d78-9223-4b9ffcb2aec1\n" +
		"\n"

	tests := []struct {
		name        string
		userStatus  int
		project     string
		expected    string
		expectedErr string
	}{
		{
			name:       "linked project",
			userStatus: http.StatusOK,
			project:    testProject,
			expected: userSection +
				"Project\n" +
				"  Name:      my-app\n" +
				"  ID:        5f2d1e4a-8b7c-4d3e-9f1a-2b3c4d5e6f70\n" +
				"  Subdomain: abcdefghijklmnopqrst\n" +
				"  Region:    eu-central-1\n",
			expectedErr: "",
		},
		{
			name:       "no linked project",
			userStatus: http.StatusOK,
			project:    "",
			expected: userSection +
				"Project\n" +
				"  Not linked, run `nhost link` to link one\n",
			expectedErr: "",
		},
		{
			name:        "auth fails",
			userStatus:  http.StatusUnauthorized,
			project:     "",
			expected:    "",
			expectedErr: "failed to get user: 401 Unauthorized",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := newAuthServer(t, tc.userStatus)

			dotNhost := t.TempDir()
			if tc.project != "" {
				if err := os.WriteFile(
					filepath.Join(dotNhost, "project.json"), []byte(tc.project), 0o600,
				); err != nil {
					t.Fatalf("failed to write project file: %v", err)
				}
			}

			flags, err := clienv.Flags()
			if err != nil {
				t.Fatalf("failed to get clienv flags: %v", err)
			}

			var out bytes.Buffer

			cmd := info.Command()
			cmd.Flags = append(cmd.Flags, flags...)
			cmd.Writer = &out
			cmd.ErrWriter = &out

			err = cmd.Run(t.Context(), []string{
				"info",
				"--auth-url", srv.URL,
				"--pat", testPAT,
				"--dot-nhost-folder", dotNhost,
			})

			gotErr := ""
			if err != nil {
				gotErr = err.Error()
			}

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("unexpected error (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expected, out.String()); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}
