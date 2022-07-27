package service

import (
	"context"
	"fmt"
	"github.com/avast/retry-go/v4"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Ports struct {
	Console  int
	GraphQL  int
	Postgres int
}

const (
	retryCount = 3
)

type Manager interface {
	SyncExec(ctx context.Context, f func(ctx context.Context) error) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	StopSvc(ctx context.Context, svc ...string) error
	SetGitBranch(string)
	HasuraConsoleURL() string
}

func NewDockerComposeManager(c *nhost.Configuration, ports compose.Ports, env []string, gitBranch string, projectName string, logger logrus.FieldLogger, status *util.Status, debug bool) *dockerComposeManager {
	if gitBranch == "" {
		gitBranch = "main"
	}

	return &dockerComposeManager{
		ports:         ports,
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
	ports         compose.Ports
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
	cmd, err := compose.WrapperCmd(ctx, []string{"up", "-d", "--wait", compose.SvcPostgres, compose.SvcGraphqlEngine, compose.SvcFunctions, compose.SvcHasuraConsole}, m.composeConfig, ds)
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

	// migrations
	{
		files, err := os.ReadDir(nhost.MIGRATIONS_DIR)
		if err != nil {
			return err
		}

		if len(files) > 0 {
			err = m.applyMigrations(ctx, ds)
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
			err = m.exportMetadata(ctx, ds)
			if err != nil {
				m.status.Error("Failed to export metadata")
				m.l.WithError(err).Debug("Failed to export metadata")
				return err
			}
		}

		err = m.applyMetadata(ctx, ds)
		if err != nil {
			m.status.Error("Failed to apply metadata")
			m.l.WithError(err).Debug("Failed to apply metadata")
			return err
		}
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

	// seeds
	err = m.applySeeds(ctx, ds)
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
	return m.composeConfig.PublicHasuraConsole()
}

func (m *dockerComposeManager) svcEndpoints() error {
	fmt.Println("\n\nURLs:")
	fmt.Printf("- Postgres:\t\t%s\n", m.composeConfig.PublicPostgresConnectionString())
	fmt.Printf("- GraphQL:\t\t%s\n", m.composeConfig.PublicHasuraConnectionString())
	fmt.Printf("- Auth:\t\t\t%s\n", m.composeConfig.PublicAuthConnectionString())
	fmt.Printf("- Storage:\t\t%s\n", m.composeConfig.PublicStorageConnectionString())
	fmt.Printf("- Functions:\t\t%s\n", m.composeConfig.PublicFunctionsConnectionString())
	fmt.Printf("\n- Hasura console:\t%s\n", m.composeConfig.PublicHasuraConsole())
	return nil
}

func (m *dockerComposeManager) Stop(ctx context.Context) error {
	m.l.Debug("Stopping docker compose")
	cmd, err := compose.WrapperCmd(ctx, []string{"stop"}, m.composeConfig, &compose.DataStreams{})
	if err != nil {
		m.l.WithError(err).Debug("Failed to stop docker compose")
		return err
	}

	m.setProcessToStartInItsOwnProcessGroup(cmd)
	return cmd.Run()
}

func (m *dockerComposeManager) StopSvc(ctx context.Context, svc ...string) error {
	m.status.Executing(fmt.Sprintf("Stopping service(s) %s", strings.Join(svc, ", ")))
	m.l.Debugf("Stopping %s service(s)", strings.Join(svc, ", "))
	cmd, err := compose.WrapperCmd(ctx, append([]string{"stop"}, svc...), m.composeConfig, nil)
	if err != nil {
		m.l.WithError(err).Debugf("Failed to stop %s service", svc)
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
func (m *dockerComposeManager) applySeeds(ctx context.Context, ds *compose.DataStreams) error {
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

	seeds, err := compose.WrapperCmd(
		ctx,
		[]string{"exec", compose.SvcHasuraConsole, "hasura", "seeds", "apply", "--database-name", "default", "--disable-interactive", "--skip-update-check"},
		m.composeConfig,
		ds,
	)
	if err != nil {
		return fmt.Errorf("Failed to apply migrations: %w", err)
	}

	err = seeds.Run()
	if err != nil && ctx.Err() != context.Canceled {
		return fmt.Errorf("Failed to apply migrations: %w", err)
	}

	return ioutil.WriteFile(seedsFlagFile, []byte{}, 0644)
}

func (m *dockerComposeManager) applyMigrations(ctx context.Context, ds *compose.DataStreams) error {
	select {
	case <-ctx.Done():
		return nil
	default:
	}

	m.status.Executing("Applying migrations...")
	err := retry.Do(func() error {
		m.l.Debug("Applying migrations")
		migrate, err := compose.WrapperCmd(
			ctx,
			[]string{"exec", compose.SvcHasuraConsole, "hasura", "migrate", "apply", "--database-name", "default", "--disable-interactive", "--skip-update-check"},
			m.composeConfig,
			ds,
		)
		if err != nil {
			return fmt.Errorf("Failed to apply migrations: %w", err)
		}

		err = migrate.Run()
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

func (m *dockerComposeManager) exportMetadata(ctx context.Context, ds *compose.DataStreams) error {
	m.status.Executing("Exporting metadata...")
	err := retry.Do(func() error {
		m.l.Debug("Exporting metadata")
		export, err := compose.WrapperCmd(
			ctx,
			[]string{"exec", compose.SvcHasuraConsole, "hasura", "--skip-update-check", "metadata", "export"},
			m.composeConfig,
			ds,
		)
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("failed to export metadata: %w", err)
		}

		err = export.Run()
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("failed to export metadata: %w", err)
		}

		return nil
	}, retry.Attempts(retryCount), retry.OnRetry(func(n uint, err error) {
		m.l.Debugf("Retrying metadata export: attempt %d\n", n)
	}))

	return err
}

func (m *dockerComposeManager) applyMetadata(ctx context.Context, ds *compose.DataStreams) error {
	m.status.Executing("Applying metadata...")
	err := retry.Do(func() error {
		m.l.Debug("Applying metadata")
		applyMetadata, err := compose.WrapperCmd(
			ctx,
			[]string{"exec", compose.SvcHasuraConsole, "hasura", "--skip-update-check", "metadata", "apply"},
			m.composeConfig,
			ds,
		)
		if err != nil && ctx.Err() != context.Canceled {
			return fmt.Errorf("failed to apply metadata: %w", err)
		}

		err = applyMetadata.Run()
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
	graphqlPort := m.ports[compose.SvcGraphqlEngine]
	// GET /healthz and check for 200
	resp, err := http.Get(fmt.Sprintf("http://localhost:%d/healthz", graphqlPort))
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
