package service

import (
	"context"
	"fmt"
	"github.com/nhost/cli/aws/s3client"
	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

type Manager interface {
	SyncExec(ctx context.Context, f func(ctx context.Context) error) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	SetGitBranch(string)
	HasuraConsoleURL() string
	Endpoints() *Endpoints
}

func NewDockerComposeManager(c *nhost.Configuration, hc *hasura.Client, ports nhost.Ports, env []string, gitBranch, projectName string, logger logrus.FieldLogger, status *util.Status, debug bool) *dockerComposeManager {
	if gitBranch == "" {
		gitBranch = "main"
	}

	return &dockerComposeManager{
		ports:         ports,
		hc:            hc,
		debug:         debug,
		env:           env,
		branch:        gitBranch,
		projectName:   projectName,
		nhostConfig:   c,
		composeConfig: compose.NewConfig(c, ports, env, gitBranch, projectName),
		l:             logger,
		status:        status,
	}
}

type dockerComposeManager struct {
	sync.Mutex
	ports         nhost.Ports
	hc            *hasura.Client
	debug         bool
	branch        string
	projectName   string
	nhostConfig   *nhost.Configuration
	composeConfig *compose.Config
	status        *util.Status
	l             logrus.FieldLogger
	env           []string
}

func (m *dockerComposeManager) SyncExec(ctx context.Context, f func(ctx context.Context) error) error {
	m.Lock()
	defer m.Unlock()

	return f(ctx)
}

func (m *dockerComposeManager) SetGitBranch(gitBranch string) {
	if m.branch == gitBranch {
		return
	}

	m.branch = gitBranch
	m.composeConfig = compose.NewConfig(m.nhostConfig, m.ports, m.env, gitBranch, m.projectName)
}

func (m *dockerComposeManager) Start(ctx context.Context) error {
	ds := &compose.DataStreams{}

	if err := m.startPostgresGraphqlFunctions(ctx, ds); err != nil {
		return err
	}

	if err := m.waitForGraphqlEngine(ctx, time.Millisecond*100, time.Minute*2); err != nil {
		return err
	}

	// run all containers & wait for healthy/running services
	if err := m.waitForServicesToBeRunningHealthy(ctx, ds); err != nil {
		return err
	}

	if err := m.ensureBucketExists(ctx); err != nil {
		return err
	}

	// migrations
	if err := m.applyMigrations(ctx); err != nil {
		return err
	}

	// metadata
	if err := m.applyMetadata(ctx); err != nil {
		return err
	}

	// seeds
	return m.applySeeds(ctx)
}

func (m *dockerComposeManager) ensureBucketExists(ctx context.Context) error {
	const bucketName = "nhost"

	client, err := s3client.NewForMinio(nhost.MINIO_USER, nhost.MINIO_PASSWORD, m.ports.MinioS3())
	if err != nil {
		return err
	}

	bucketCreator := s3client.NewBucketCreator(client)
	return bucketCreator.EnsureBucketExists(ctx, bucketName)
}

func (m *dockerComposeManager) startPostgresGraphqlFunctions(ctx context.Context, ds *compose.DataStreams) error {
	m.status.Executing("Starting nhost app...")
	m.l.Debug("Starting docker compose")

	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait", compose.SvcPostgres, compose.SvcGraphqlEngine, compose.SvcFunctions}, m.composeConfig, ds)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		m.status.Error("Failed to start nhost app")
		m.l.WithError(err).Debug("Failed to start docker compose")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	return nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
}

func (m *dockerComposeManager) HasuraConsoleURL() string {
	return fmt.Sprintf("http://localhost:%d", m.ports.HasuraConsole())
}

func (m *dockerComposeManager) Endpoints() *Endpoints {
	return newEndpoints(
		m.composeConfig.PublicPostgresConnectionString(),
		m.composeConfig.PublicHasuraConnectionString(),
		m.composeConfig.PublicAuthConnectionString(),
		m.composeConfig.PublicStorageConnectionString(),
		m.composeConfig.PublicFunctionsConnectionString(),
		m.HasuraConsoleURL(),
	)
}

func (m *dockerComposeManager) Stop(ctx context.Context) error {
	m.l.Debug("Stopping docker compose")

	// kill all services but postgres
	cmd, err := compose.WrapperCmd(
		ctx,
		[]string{"kill",
			compose.SvcFunctions,
			compose.SvcGraphqlEngine,
			compose.SvcTraefik,
			compose.SvcAuth,
			compose.SvcMailhog,
			compose.SvcMinio,
			compose.SvcStorage,
			compose.SvcHasura,
		}, m.composeConfig, &compose.DataStreams{})
	if err != nil {
		m.l.WithError(err).Debug("Failed to stop functions service")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	err = nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
	if err != nil {
		m.l.WithError(err).Debug("Failed to stop functions service")
		return err
	}

	cmd, err = compose.WrapperCmd(ctx, []string{"down", "--remove-orphans"}, m.composeConfig, &compose.DataStreams{})
	if err != nil {
		m.l.WithError(err).Debug("Failed to stop docker compose")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	return nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
}

func (m *dockerComposeManager) waitForServicesToBeRunningHealthy(ctx context.Context, ds *compose.DataStreams) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	m.status.Executing("Waiting for all containers to be up and running...")
	m.l.Debug("Waiting for all containers to be up and running")

	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait"}, m.composeConfig, ds)
	if err != nil {
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	err = nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		m.status.Error("Failed to wait for running/healthy services")
		m.l.WithError(err).Debug("Failed to wait for running/healthy services")
		return err
	}

	return nil
}

// applySeeds applies seeds if they were not applied
func (m *dockerComposeManager) applySeeds(ctx context.Context) error {
	if !util.PathExists(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)) {
		return nil
	}

	seedsFlagFile := filepath.Join(nhost.DOT_NHOST_DIR, "seeds.applied")

	if util.PathExists(seedsFlagFile) {
		// seeds already applied
		return nil
	}

	m.status.Executing("Applying seeds")
	m.l.Debug("Applying seeds")

	err := m.hc.ApplySeed(ctx, m.debug)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		return fmt.Errorf("Failed to apply migrations: %w", err)
	}

	return os.WriteFile(seedsFlagFile, []byte{}, 0600)
}

func (m *dockerComposeManager) applyMigrations(ctx context.Context) error {
	files, err := os.ReadDir(nhost.MIGRATIONS_DIR)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		return nil
	}

	m.status.Executing("Applying migrations...")
	m.l.Debug("Applying migrations")

	if err = m.hc.ApplyMigrations(ctx, m.debug); err != nil {
		return fmt.Errorf("Failed to apply migrations: %w", err)
	}

	return nil
}

func (m *dockerComposeManager) setProcessToStartInItsOwnProcessGroup(cmd *exec.Cmd) {
	// Start a process in its own process group. This will prevent the process from being killed when the parent process is killed
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func (m *dockerComposeManager) exportMetadata(ctx context.Context) error {
	m.status.Executing("Exporting metadata...")
	m.l.Debug("Exporting metadata")

	return m.hc.ExportMetadata(ctx, m.debug)
}

func (m *dockerComposeManager) applyMetadata(ctx context.Context) error {
	metaFiles, err := os.ReadDir(nhost.METADATA_DIR)
	if err != nil {
		return err
	}

	if len(metaFiles) == 0 {
		if err := m.exportMetadata(ctx); err != nil {
			return err
		}
	}

	m.status.Executing("Applying metadata...")
	m.l.Debug("Applying metadata")

	return m.hc.ApplyMetadata(ctx, m.debug)
}

func (m *dockerComposeManager) hasuraHealthcheck(ctx context.Context) (bool, error) {
	// GET /healthz and check for 200
	req, err := http.NewRequest("GET", fmt.Sprintf("http://localhost:%d/healthz", m.ports.GraphQL()), http.NoBody)
	if err != nil {
		return false, err
	}

	req = req.WithContext(ctx)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}

	_ = resp.Body.Close()

	return resp.StatusCode == 200, nil
}

func (m *dockerComposeManager) waitForGraphqlEngine(ctx context.Context, interval, timeout time.Duration) error {
	m.status.Executing("Waiting for graphql-engine service to be ready...")
	m.l.Debug("Waiting for graphql-engine service to be ready")

	t := time.After(timeout)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t:
			return fmt.Errorf("timeout: graphql-engine not ready, please run the command again")
		case <-ticker.C:
			if ok, err := m.hasuraHealthcheck(ctx); err == nil && ok {
				return nil
			}
		}
	}
}
