package cmd

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestGetHandlerUsesCommandVersion(t *testing.T) {
	t.Parallel()

	const commandVersion = "9.9.9"

	var handler http.Handler

	serveCommand := CommandServe()
	app := &cli.Command{
		Name:    "auth",
		Version: commandVersion,
		Flags:   serveCommand.Flags,
		Action: func(ctx context.Context, cmd *cli.Command) error {
			var err error

			handler, err = getHandler(
				ctx,
				cmd,
				nil,
				nil,
				slog.New(slog.DiscardHandler),
			)

			return err
		},
	}

	if err := app.Run(
		t.Context(),
		[]string{
			"auth",
			"--encryption-key=unused",
			"--smtp-host=postmark",
			"--client-url=https://app.example.com",
			"--server-url=https://auth.example.com",
			`--hasura-graphql-jwt-secret={"type":"HS256","key":"version-test-jwt-secret-32-bytes-long"}`,
		},
	); err != nil {
		t.Fatalf("running command: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/version", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("GET /version status = %d, want %d", response.Code, http.StatusOK)
	}

	var body struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshalling response: %v", err)
	}

	if body.Version != commandVersion {
		t.Errorf("version = %q, want %q", body.Version, commandVersion)
	}
}
