package service

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/sirupsen/logrus"
)

type Launcher struct {
	mgr  Manager
	hc   HasuraConsoleStartStopper
	p    nhost.Ports
	s    *util.Status
	l    logrus.FieldLogger
	pidF *pidFile
}

type HasuraConsoleStartStopper interface {
	StartConsole(ctx context.Context, consoleURL, consoleAPIURL uint32, debug bool) error
	StopConsole() error
}

func NewLauncher(mgr Manager, hc HasuraConsoleStartStopper, p nhost.Ports, s *util.Status, l logrus.FieldLogger) *Launcher {
	return &Launcher{
		mgr: mgr,
		hc:  hc,
		p:   p,
		s:   s,
		l:   l,
	}
}

func (l *Launcher) ensureInitialised() error {
	if l.pidF == nil {
		return fmt.Errorf("not initialised")
	}

	return nil
}

func (l *Launcher) Init() error {
	p := newPidFile(filepath.Join(nhost.DOT_NHOST_DIR, "pid"))
	if err := p.Create(); err != nil {
		return err
	}

	l.pidF = p
	return nil
}

func (l *Launcher) HasuraConsoleURL() string {
	return l.mgr.HasuraConsoleURL()
}

func (l *Launcher) Start(ctx context.Context, startTimeout time.Duration, debug bool) error {
	l.l.Debugf("start timeout is set to %s", startTimeout.String())
	if err := l.ensureInitialised(); err != nil {
		return err
	}

	startCtx, cancel := context.WithTimeout(ctx, startTimeout)
	defer cancel()

	return l.mgr.SyncExec(startCtx, func(cCtx context.Context) error {
		// stop services to release ports, just in case there are any leftover containers from previous run
		if err := l.mgr.Stop(cCtx); err != nil {
			return err
		}

		// check if ports are available
		if err := l.p.EnsurePortsAvailable(); err != nil {
			return err
		}

		// start docker compose services
		if err := l.mgr.Start(cCtx); err != nil {
			return err
		}

		// start hasura console
		if err := l.launchAndWaitForHasuraConsole(ctx, debug); err != nil {
			return err
		}

		l.s.Info("Ready to use")
		l.l.Debug("Ready to use")

		// dump endpoints
		l.mgr.Endpoints().Dump(os.Stdout)

		return nil
	})
}

func (l *Launcher) Terminate(ctx context.Context) error {
	if err := l.ensureInitialised(); err != nil {
		return err
	}

	_ = l.hc.StopConsole()
	_ = l.mgr.Stop(ctx)
	_ = l.pidF.Remove()
	return nil
}

func (l *Launcher) launchAndWaitForHasuraConsole(ctx context.Context, debug bool) error {
	err := l.hc.StartConsole(ctx, l.p.HasuraConsole(), l.p.HasuraConsoleAPI(), debug)
	if err != nil {
		return err
	}

	l.s.Info("Waiting for hasura console to be ready")
	l.l.Debug("Waiting for hasura console to be ready")

	// wait for the hasura console to be ready
	return endpointChecker(ctx, l.mgr.HasuraConsoleURL(), 10*time.Second)
}

func endpointChecker(ctx context.Context, endpoint string, timeout time.Duration) error {
	t := time.After(timeout)

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t:
			return fmt.Errorf("timeout: hasura console is not ready, please run the command again")
		case <-ticker.C:
			resp, err := http.Get(endpoint) //nolint:gosec
			if err == nil {
				_ = resp.Body.Close()
			}
			if resp != nil && resp.StatusCode == http.StatusOK && err == nil {
				return nil
			}
		}
	}
}
