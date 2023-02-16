package hasura

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

type console struct {
	cliPath     string
	workdir     string
	endpoint    string
	adminSecret string
	cmd         *exec.Cmd
}

func initConsole(cliPath, workdir, endpoint, adminSecret string) *console {
	return &console{
		cliPath:     cliPath,
		workdir:     workdir,
		endpoint:    endpoint,
		adminSecret: adminSecret,
	}
}

func (c *console) start(ctx context.Context, consolePort, consoleAPIPort uint32, debug bool) error {
	if c.cmd != nil {
		return fmt.Errorf("console already started")
	}

	args := []string{
		"console",
		"--no-browser",
		"--console-port", fmt.Sprint(consolePort),
		"--api-port", fmt.Sprint(consoleAPIPort),
		"--endpoint", c.endpoint,
		"--admin-secret", c.adminSecret,
		"--skip-update-check",
	}

	cmd := exec.CommandContext(ctx, c.cliPath, args...)
	cmd.Dir = c.workdir
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	if debug {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	c.cmd = cmd

	return c.cmd.Start()
}

func (c *console) stop() error {
	if c.cmd == nil {
		return fmt.Errorf("console not started")
	}

	if c.cmd.Process != nil {
		err := c.cmd.Process.Kill()
		if err != nil {
			return err
		}
	}

	err := c.cmd.Wait()
	c.cmd = nil
	return err
}
