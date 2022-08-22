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
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	slowStartWaitMsg = "It takes more than usual to start the nhost project. Most likely because CLI needs to pull js dependencies inside a container. Please wait..."
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
	startTime := time.Now()
	defer func() {
		m.l.Debugf("Start took %s", time.Since(startTime).String())
	}()

	ds := &compose.DataStreams{}

	m.status.Executing("Starting local Nhost project...")
	m.l.Debug("Starting docker compose")

	// spin up the "functions" container first, because it's the one that's going to take the longest to start
	// though we don't wait for it to be healthy, only start
	if err := m.startFunctions(ctx, ds); err != nil {
		return err
	}

	if err := m.startPostgresGraphql(ctx, ds); err != nil {
		return err
	}

	if err := m.waitForGraphqlEngine(ctx, time.Millisecond*100, time.Minute*2); err != nil {
		return err
	}

	containersHealthy := make(chan bool)

	go func() {
		ticker := time.NewTicker(time.Second * 20)
		defer ticker.Stop()

		showSlowStartMsg := time.After(time.Second * 15)

		for {
			select {
			case <-containersHealthy:
				return
			case <-ticker.C:
				m.status.Executingln("Processing...")
				m.l.Debug("Processing...")
			case <-showSlowStartMsg:
				m.status.Executing(slowStartWaitMsg)
				m.l.Debug(slowStartWaitMsg)
			}
		}
	}()

	// start all containers, this is where we make sure that all containers are up & running, including "functions"
	if err := m.waitForServicesToBeRunningHealthy(ctx, ds); err != nil {
		return err
	}

	containersHealthy <- true

	// ensure default bucket `nhost` exists in Minio S3
	if err := m.ensureBucketExists(ctx); err != nil {
		return err
	}

	// apply local migrations
	if err := m.applyMigrations(ctx); err != nil {
		return err
	}

	// apply local metadata
	if err := m.applyMetadata(ctx); err != nil {
		return err
	}

	// restart auth and storage
	// we do this because auth and storage might have new metadata to apply
	if err := m.restartContainers(ctx, ds, []string{compose.SvcAuth, compose.SvcStorage}); err != nil {
		return err
	}

	// wait until all services are running healthy
	if err := m.waitForServicesToBeRunningHealthy(ctx, ds); err != nil {
		return err
	}

	// export metadata
	// We export the metadata here because there might be new metadata from
	// auth and storage that we want to sync locally.
	if err := m.exportMetadata(ctx); err != nil {
		return err
	}

	// seeds
	return m.applySeeds(ctx)
}

func (m *dockerComposeManager) startFunctions(ctx context.Context, ds *compose.DataStreams) error {
	m.status.Executing("Starting functions...")
	m.l.Debug("Starting functions")

	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", compose.SvcFunctions}, m.composeConfig, ds)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		m.status.Error("Failed to start functions container")
		m.l.WithError(err).Debug("Failed to start functions")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	return nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
}

func (m *dockerComposeManager) startPostgresGraphql(ctx context.Context, ds *compose.DataStreams) error {
	m.l.Debugf("Starting %s containers...", strings.Join([]string{compose.SvcPostgres, compose.SvcGraphqlEngine}, ", "))
	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait", compose.SvcPostgres, compose.SvcGraphqlEngine}, m.composeConfig, ds)
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

func (m *dockerComposeManager) ensureBucketExists(ctx context.Context) error {
	m.l.Debug("Ensuring S3 bucket exists")
	const bucketName = "nhost"

	client, err := s3client.NewForMinio(nhost.MINIO_USER, nhost.MINIO_PASSWORD, m.ports.MinioS3())
	if err != nil {
		return err
	}

	bucketCreator := s3client.NewBucketCreator(client)
	return bucketCreator.EnsureBucketExists(ctx, bucketName)
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
		fmt.Sprintf("http://localhost:%d", m.ports.Mailhog()),
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
	m.l.Debug("Checking if seeds should be applied")
	if !util.PathExists(filepath.Join(nhost.SEEDS_DIR, nhost.DATABASE)) {
		m.l.Debug("Seeds not found")
		return nil
	}

	seedsFlagFile := filepath.Join(nhost.DOT_NHOST_DIR, "seeds.applied")

	if util.PathExists(seedsFlagFile) {
		m.l.Debug("Seeds already applied")
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

		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	return os.WriteFile(seedsFlagFile, []byte{}, 0600)
}

func (m *dockerComposeManager) applyMigrations(ctx context.Context) error {
	m.l.Debug("Checking if migrations need to be applied")
	files, err := os.ReadDir(nhost.MIGRATIONS_DIR)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		m.l.Debug("No migrations files found")
		return nil
	}

	m.status.Executing("Applying migrations...")
	m.l.Debug("Applying migrations")

	if err = m.hc.ApplyMigrations(ctx, m.debug); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
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

func (m *dockerComposeManager) restartContainers(ctx context.Context, ds *compose.DataStreams, containers []string) error {
	m.l.Debug("Restarting containers:", containers)

	restartCommand := append([]string{"restart"}, containers...)

	cmd, err := compose.WrapperCmd(ctx, restartCommand, m.composeConfig, ds)
	if err != nil {
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)

	err = nhost.RunCmdAndCaptureStderrIfNotSetup(cmd)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		m.status.Error("Failed to restart containers")
		m.l.WithError(err).Debug("Failed to restart containers")
		return err
	}

	return nil
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
