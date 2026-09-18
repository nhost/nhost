package cmd

import (
	"context"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/urfave/cli/v3"
)

type versionMetadataSource struct{}

func (*versionMetadataSource) InitialLoad(context.Context) (*metadata.Metadata, error) {
	return &metadata.Metadata{Databases: nil, RemoteSchemas: nil}, nil
}

func (*versionMetadataSource) Watch(context.Context) <-chan metadata.Update {
	updates := make(chan metadata.Update)
	close(updates)

	return updates
}

func (*versionMetadataSource) HasuraSnapshotJSON() ([]byte, int64) {
	return nil, 0
}

func (*versionMetadataSource) Close() {}

func TestNewServiceControllerUsesCommandVersion(t *testing.T) {
	t.Parallel()

	const commandVersion = "9.9.9"

	var ctrl *controller.Controller

	serveCommand := CommandServe()
	serveCommand.Action = func(ctx context.Context, cmd *cli.Command) error {
		var err error

		ctrl, err = newServiceController(
			ctx,
			cmd,
			middleware.NewNoOpJWTAuthenticator(),
			&versionMetadataSource{},
			slog.New(slog.DiscardHandler),
			nil,
		)

		return err
	}

	app := &cli.Command{
		Name:     "constellation",
		Version:  commandVersion,
		Commands: []*cli.Command{serveCommand},
	}

	if err := app.Run(
		t.Context(),
		[]string{
			"constellation",
			"serve",
			"--admin-secret=version-test-admin-secret",
			`--jwt-secret={"type":"HS256","key":"version-test-jwt-secret-32-bytes-long"}`,
		},
	); err != nil {
		t.Fatalf("running command: %v", err)
	}

	defer ctrl.Close()

	response, err := ctrl.GetVersion(t.Context(), api.GetVersionRequestObject{})
	if err != nil {
		t.Fatalf("GetVersion: %v", err)
	}

	body, ok := response.(api.GetVersion200JSONResponse)
	if !ok {
		t.Fatalf("GetVersion response = %T, want api.GetVersion200JSONResponse", response)
	}

	if body.Version != commandVersion {
		t.Errorf("version = %q, want %q", body.Version, commandVersion)
	}
}
