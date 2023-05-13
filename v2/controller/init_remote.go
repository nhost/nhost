package controller

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/nhost/cli/v2/nhostclient/graphql"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func InitRemote(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	domain string,
	fs *system.PathStructure,
) error {
	proj, err := GetAppInfo(ctx, p, cl, fs)
	if err != nil {
		return err
	}

	session, err := LoadSession(ctx, p, cl, fs)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	cfg, err := configPull(ctx, p, cl, proj, session, fs)
	if err != nil {
		return err
	}

	if err := initInit(ctx, fs); err != nil {
		return err
	}

	hasuraAdminSecret, err := cl.GetHasuraAdminSecret(
		ctx, proj.ID, graphql.WithAccessToken(session.Session.AccessToken),
	)
	if err != nil {
		return fmt.Errorf("failed to get hasura admin secret: %w", err)
	}

	hasuraEndpoint := fmt.Sprintf(
		"https://%s.hasura.%s.%s", proj.Subdomain, proj.Region.AwsName, domain,
	)

	p.Println(tui.Info("Creating postgres migration"))
	if err := createPostgresMigration(
		ctx, fs.NhostFolder(), *cfg.Hasura.Version, hasuraEndpoint, hasuraAdminSecret.App.Config.Hasura.AdminSecret, "public",
	); err != nil {
		return fmt.Errorf("failed to create postgres migration: %w", err)
	}

	p.Println(tui.Info("Downloading metadata"))
	if err := createMetada(
		ctx, fs.NhostFolder(), *cfg.Hasura.Version, hasuraEndpoint, hasuraAdminSecret.App.Config.Hasura.AdminSecret,
	); err != nil {
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	p.Println(tui.Info("Project initialized successfully!"))
	return nil
}

func createPostgresMigration(
	ctx context.Context, nhostfolder, hasuraVersion, hasuraEndpoint, adminSecret, schema string,
) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "run",
		"-v", fmt.Sprintf("%s:/app", nhostfolder),
		"-w", "/app",
		"-it", "--rm",
		"--entrypoint", "hasura-cli",
		fmt.Sprintf("hasura/graphql-engine:%s.cli-migrations-v3", hasuraVersion),
		"--endpoint", hasuraEndpoint,
		"--admin-secret", adminSecret,
		"migrate", "create", "init", "--from-server", "--schema", schema,
		"--database-name", "default",
		"--skip-update-check",
		"--log-level", "ERROR",
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(os.Stdout, f); err != nil {
		return fmt.Errorf("failed to copy output: %w", err)
	}

	return nil
}

func createMetada(
	ctx context.Context, nhostfolder, hasuraVersion, hasuraEndpoint, adminSecret string,
) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "run",
		"-v", fmt.Sprintf("%s:/app", nhostfolder),
		"-w", "/app",
		"-it", "--rm",
		"--entrypoint", "hasura-cli",
		fmt.Sprintf("hasura/graphql-engine:%s.cli-migrations-v3", hasuraVersion),
		"--endpoint", hasuraEndpoint,
		"--admin-secret", adminSecret,
		"metadata", "export",
		"--skip-update-check",
		"--log-level", "ERROR",
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(os.Stdout, f); err != nil {
		return fmt.Errorf("failed to copy output: %w", err)
	}

	return nil
}
