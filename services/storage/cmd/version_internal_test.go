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
		Name:    "storage",
		Version: commandVersion,
		Flags:   serveCommand.Flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			var err error

			handler, err = getHandler( //nolint:contextcheck // getHandler has no context parameter.
				cmd,
				nil,
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
			"storage",
			"--postgres-migrations-source=unused",
			"--api-root-prefix=",
			"--clamav-server=",
			"--hasura-graphql-admin-secret=",
			"--cors-allow-origins=*",
			"--cors-allow-credentials=false",
			"--fastly-service=",
			"--fastly-key=",
			"--cdn-cache-control=false",
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
		BuildVersion string `json:"buildVersion"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshalling response: %v", err)
	}

	if body.BuildVersion != commandVersion {
		t.Errorf("buildVersion = %q, want %q", body.BuildVersion, commandVersion)
	}
}
