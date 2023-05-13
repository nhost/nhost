package controller

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nhost/cli/v2/dockercompose"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

const (
	dockerComposeFilepath = ".nhost/docker-compose.yaml"
	defaultBranchName     = "nogit"
)

func dev(
	ctx context.Context,
	p Printer,
	dc *dockercompose.DockerCompose,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	fs *system.PathStructure,
) error {
	ctx, cancel := context.WithCancel(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	go func() {
		<-sigChan
		cancel()
	}()

	cfg, err := ConfigValidate(p, fs)
	if err != nil {
		return err
	}

	p.Println(tui.Info("Setting up Nhost development environment..."))
	composeFile, err := dockercompose.ComposeFileFromConfig(
		cfg, projectName, httpPort, useTLS, postgresPort,
		fs.DataFolder(), fs.NhostFolder(), fs.DotNhostFolder(), fs.FunctionsFolder(),
	)
	if err != nil {
		return fmt.Errorf("failed to generate docker-compose.yaml: %w", err)
	}
	if err := dc.WriteComposeFile(composeFile); err != nil {
		return fmt.Errorf("failed to write docker-compose.yaml: %w", err)
	}

	p.Println(tui.Info("Starting Nhost development environment..."))

	if err = dc.Start(ctx); err != nil {
		return fmt.Errorf("failed to start Nhost development environment: %w", err)
	}

	p.Println(tui.Info("Applying migrations..."))
	if err = dc.ApplyMigrations(ctx); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	p.Println(tui.Info("Applying metadata..."))
	if err = dc.ApplyMetadata(ctx); err != nil {
		return fmt.Errorf("failed to apply metadata: %w", err)
	}

	p.Println(tui.Info("Nhost development environment started."))

	printInfo(p, httpPort, useTLS)

	p.Println()
	p.Println("Run `nhost up` to reload the development environment")
	p.Println("Run `nhost down` to stop the development environment")
	p.Println("Run `nhost logs` to watch the logs")
	return nil
}

func url(service string, port uint, useTLS bool) string {
	if useTLS && port == 443 {
		return fmt.Sprintf("https://local.%s.nhost.run", service)
	} else if !useTLS && port == 80 {
		return fmt.Sprintf("http://local.%s.nhost.run", service)
	}

	protocol := "http"
	if useTLS {
		protocol = "https"
	}
	return fmt.Sprintf("%s://local.%s.nhost.run:%d", protocol, service, port)
}

func printInfo(p Printer, port uint, useTLS bool) {
	p.Println("URLs:")
	p.Println("- Postgres:             postgres://postgres:postgres@localhost:5432/postgres")
	p.Println("- Hasura:              ", url("hasura", port, useTLS))
	p.Println("- GraphQL:             ", url("graphql", port, useTLS))
	p.Println("- Auth:                ", url("auth", port, useTLS))
	p.Println("- Storage:             ", url("storage", port, useTLS))
	p.Println("- Functions:           ", url("functions", port, useTLS))
	p.Println("- Dashboard:           ", url("dashboard", port, useTLS))
	p.Println()
	p.Println("SDK Configuration:")
	p.Println(" Subdomain:             local")
	p.Println(" Region:                (empty)")
}

func Dev(
	ctx context.Context,
	p Printer,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	fs *system.PathStructure,
) error {
	dc := dockercompose.New(dockerComposeFilepath, projectName)

	if err := dev(
		ctx, p, dc, projectName, httpPort, useTLS, postgresPort, fs,
	); err != nil {
		p.Println(tui.Warn(err.Error()))

		p.Print(tui.PromptMessage("Do you want to stop Nhost development environment it? [y/N] "))
		resp, err := tui.PromptInput(false)
		if err != nil {
			p.Print(tui.Warn("failed to read input: %s", err))
			return nil
		}
		if resp != "y" {
			return nil
		}

		p.Println(tui.Info("Stopping Nhost development environment..."))
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()

		if err := dc.Stop(ctx); err != nil { //nolint:contextcheck
			p.Print(tui.Warn("failed to stop Nhost development environment: %s", err))
		}

		return err //nolint:wrapcheck
	}

	return nil
}
