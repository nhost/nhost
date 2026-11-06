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
	testUserNoEmail = `{
		"id": "1c8a47be-9915-4d78-9223-4b9ffcb2aec1",
		"displayName": "Jane Doe"
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

func newAuthServer(t *testing.T, userStatus int, user string) *httptest.Server {
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

		writeJSON(t, w, http.StatusOK, user)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	return srv
}

//nolint:tparallel
func TestCommand(t *testing.T) {
	t.Setenv("XDG_STATE_HOME", t.TempDir())
	t.Setenv("NHOST_PAT", "")

	userSection := "User\n" +
		"  Name:      Jane Doe\n" +
		"  Email:     jane@example.com\n" +
		"  ID:        1c8a47be-9915-4d78-9223-4b9ffcb2aec1\n" +
		"\n"

	linkedProjectSection := "Project\n" +
		"  Name:      my-app\n" +
		"  ID:        5f2d1e4a-8b7c-4d3e-9f1a-2b3c4d5e6f70\n" +
		"  Subdomain: abcdefghijklmnopqrst\n" +
		"  Region:    eu-central-1\n"

	notLinkedSection := "Project\n" +
		"  Not linked, run `nhost link` to link one\n"

	tests := []struct {
		name        string
		pat         string
		userStatus  int
		user        string
		project     string
		expected    string
		expectedErr string
	}{
		{
			name:        "linked project",
			pat:         testPAT,
			userStatus:  http.StatusOK,
			user:        testUser,
			project:     testProject,
			expected:    userSection + linkedProjectSection,
			expectedErr: "",
		},
		{
			name:        "no linked project",
			pat:         testPAT,
			userStatus:  http.StatusOK,
			user:        testUser,
			project:     "",
			expected:    userSection + notLinkedSection,
			expectedErr: "",
		},
		{
			name:       "user without email",
			pat:        testPAT,
			userStatus: http.StatusOK,
			user:       testUserNoEmail,
			project:    "",
			expected: "User\n" +
				"  Name:      Jane Doe\n" +
				"  Email:     -\n" +
				"  ID:        1c8a47be-9915-4d78-9223-4b9ffcb2aec1\n" +
				"\n" +
				notLinkedSection,
			expectedErr: "",
		},
		{
			name:       "malformed project file",
			pat:        testPAT,
			userStatus: http.StatusOK,
			user:       testUser,
			project:    "{not json",
			expected:   userSection,
			expectedErr: "failed to read linked project: failed to unmarshal object: " +
				"invalid character 'n' looking for beginning of object key string",
		},
		{
			name:       "not signed in",
			pat:        "",
			userStatus: http.StatusOK,
			user:       testUser,
			project:    testProject,
			expected: "User\n" +
				"  Not signed in, run `nhost login` to sign in\n" +
				"\n" +
				linkedProjectSection,
			expectedErr: "",
		},
		{
			name:        "auth fails",
			pat:         testPAT,
			userStatus:  http.StatusUnauthorized,
			user:        testUser,
			project:     "",
			expected:    "",
			expectedErr: "failed to get user: 401 Unauthorized",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := newAuthServer(t, tc.userStatus, tc.user)

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

			args := []string{
				"info",
				"--auth-url", srv.URL,
				"--dot-nhost-folder", dotNhost,
			}
			if tc.pat != "" {
				args = append(args, "--pat", tc.pat)
			}

			err = cmd.Run(t.Context(), args)

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
