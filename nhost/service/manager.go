package service

import (
	"context"
	"fmt"
	"github.com/avast/retry-go/v4"
	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const (
	retryCount = 3
)

type Manager interface {
	SyncExec(ctx context.Context, f func(ctx context.Context) error) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	SetGitBranch(string)
	HasuraConsoleURL() string
}

func NewDockerComposeManager(c *nhost.Configuration, hc *hasura.Client, ports nhost.Ports, env []string, gitBranch string, projectName string, logger logrus.FieldLogger, status *util.Status, debug bool) *dockerComposeManager {
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
	if m.debug {
		ds.Stdout = os.Stdout
		ds.Stderr = os.Stderr
	}

	m.status.Executing("Starting nhost app...")
	m.l.Debug("Starting docker compose")
	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait", compose.SvcPostgres, compose.SvcGraphqlEngine, compose.SvcFunctions}, m.composeConfig, ds)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Failed to start nhost app")
		m.l.WithError(err).Debug("Failed to start docker compose")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	err = cmd.Run()
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Failed to start nhost app")
		m.l.WithError(err).Debug("Failed to start docker compose")
		return err
	}

	if ctx.Err() == context.Canceled {
		return nil
	}

	err = m.waitForGraphqlEngine(ctx, time.Millisecond*100, time.Minute*2)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Timed out waiting for graphql-engine service to be ready")
		m.l.WithError(err).Debug("Timed out waiting for graphql-engine service to be ready")
		return err
	}

	if ctx.Err() == context.Canceled {
		return nil
	}

	m.status.Executing("Waiting for all containers to be up and running...")
	m.l.Debug("Waiting for all containers to be up and running")
	// run all & wait for healthy/running services
	err = m.waitForServicesToBeRunningHealthy(ctx, ds)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error(err.Error())
		m.l.WithError(err).Debug("Failed to wait for services")
		return err
	}

	if ctx.Err() == context.Canceled {
		return nil
	}

	// migrations
	{
		files, err := os.ReadDir(nhost.MIGRATIONS_DIR)
		if err != nil {
			return err
		}

		if len(files) > 0 {
			err = m.applyMigrations(ctx)
			if err != nil {
				m.status.Error("Failed to apply migrations")
				m.l.WithError(err).Debug("Failed to apply migrations")
				return err
			}
		}
	}

	if ctx.Err() == context.Canceled {
		return nil
	}

	// metadata
	{
		metaFiles, err := os.ReadDir(nhost.METADATA_DIR)
		if err != nil {
			return err
		}

		if len(metaFiles) == 0 {
			err = m.exportMetadata(ctx)
			if err != nil {
				m.status.Error("Failed to export metadata")
				m.l.WithError(err).Debug("Failed to export metadata")
				return err
			}
		}

		err = m.applyMetadata(ctx)
		if err != nil {
			m.status.Error("Failed to apply metadata")
			m.l.WithError(err).Debug("Failed to apply metadata")
			return err
		}
	}

	if ctx.Err() == context.Canceled {
		return nil
	}

	// seeds
	err = m.applySeeds(ctx)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Failed to apply seeds")
		m.l.WithError(err).Debug("Failed to apply seeds")
		return err
	}

	// wait for healthy/running services
	err = m.waitForServicesToBeRunningHealthy(ctx, ds)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error(err.Error())
		m.l.WithError(err).Debug("Failed to wait for services")
		return err
	}

	m.status.Info("Ready to use")
	m.l.Debug("Ready to use")

	return m.svcEndpoints()
}

func (m *dockerComposeManager) HasuraConsoleURL() string {
	return fmt.Sprintf("http://localhost:%d", m.ports.HasuraConsole())
}

func (m *dockerComposeManager) svcEndpoints() error {
	fmt.Println("\n\nURLs:")
	fmt.Printf("- Postgres:\t\t%s\n", m.composeConfig.PublicPostgresConnectionString())
	fmt.Printf("- GraphQL:\t\t%s\n", m.composeConfig.PublicHasuraConnectionString())
	fmt.Printf("- Auth:\t\t\t%s\n", m.composeConfig.PublicAuthConnectionString())
	fmt.Printf("- Storage:\t\t%s\n", m.composeConfig.PublicStorageConnectionString())
	fmt.Printf("- Functions:\t\t%s\n", m.composeConfig.PublicFunctionsConnectionString())
	fmt.Printf("\n- Hasura console:\t%s\n", m.HasuraConsoleURL())
	return nil
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
	err = cmd.Run()
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
	return cmd.Run()
}

func (m *dockerComposeManager) waitForServicesToBeRunningHealthy(ctx context.Context, ds *compose.DataStreams) error {
	select {
	case <-ctx.Done():
		return nil
	default:
	}

	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait"}, m.composeConfig, ds)
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Failed to wait for running/healthy services")
		m.l.WithError(err).Debug("Failed to wait for running/healthy services")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	err = cmd.Run()
	if err != nil && ctx.Err() != context.Canceled {
		m.status.Error("Failed to wait for running/healthy services")
		m.l.WithError(err).Debug("Failed to wait for running/healthy services")
		return err
	}

	return nil
}

// applySeeds applies seeds if they were not applied
func (m *dockerComposeManager) applySeeds(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	default:
	}

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
	if err != nil && ctx.Err() != context.Canceled {
		return fmt.Errorf("Failed to apply migrations: %w", err)
	}

	return ioutil.WriteFile(seedsFlagFile, []byte{}, 0644)
}

func (m *dockerComposeManager) applyMigrations(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	default:
	}

	m.status.Executing("Applying migrations...")
	err := retry.Do(func() error {
		m.l.Debug("Applying migrations")
		err := m.hc.ApplyMigrations(ctx, m.debug)
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("Failed to apply migrations: %w", err)
		}

		return nil
	}, retry.Attempts(retryCount), retry.OnRetry(func(n uint, err error) {
		m.l.Debugf("Retrying migration apply: attempt %d\n", n)
	}))

	return err
}

func (m *dockerComposeManager) setProcessToStartInItsOwnProcessGroup(cmd *exec.Cmd) {
	// Start a process in its own process group. This will prevent the process from being killed when the parent process is killed
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func (m *dockerComposeManager) exportMetadata(ctx context.Context) error {
	m.status.Executing("Exporting metadata...")
	err := retry.Do(func() error {
		m.l.Debug("Exporting metadata")
		err := m.hc.ExportMetadata(ctx, m.debug)
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("failed to export metadata: %w", err)
		}

		return nil
	}, retry.Attempts(retryCount), retry.OnRetry(func(n uint, err error) {
		m.l.Debugf("Retrying metadata export: attempt %d\n", n)
	}))

	return err
}

func (m *dockerComposeManager) applyMetadata(ctx context.Context) error {
	m.status.Executing("Applying metadata...")
	err := retry.Do(func() error {
		m.l.Debug("Applying metadata")
		err := m.hc.ApplyMetadata(ctx, m.debug)
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("failed to apply metadata: %w", err)
		}

		return nil
	}, retry.Attempts(retryCount), retry.OnRetry(func(n uint, err error) {
		m.l.Debugf("Retrying metadata apply: attempt %d\n", n)
	}))

	return err
}

func (m *dockerComposeManager) hasuraHealthcheck() (bool, error) {
	// GET /healthz and check for 200
	resp, err := http.Get(fmt.Sprintf("http://localhost:%d/healthz", m.ports.GraphQL()))
	if err != nil {
		return false, err
	}

	return resp.StatusCode == 200, nil
}

func (m *dockerComposeManager) waitForGraphqlEngine(ctx context.Context, interval time.Duration, timeout time.Duration) error {
	m.status.Executing("Waiting for graphql-engine service to be ready...")
	m.l.Debug("Waiting for graphql-engine service to be ready")

	t := time.After(timeout)

	ticker := time.NewTicker(interval)

	for range ticker.C {
		select {
		case <-ctx.Done():
			return nil
		case <-t:
			return fmt.Errorf("timeout: graphql-engine not ready, please run the command again")
		default:
			if ok, err := m.hasuraHealthcheck(); err == nil && ok {
				return nil
			}
		}
	}

	return nil
}
