package dockercompose

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/creack/pty"
	"gopkg.in/yaml.v3"
)

const op = "read"

type DockerCompose struct {
	workingDir  string
	filepath    string
	projectName string
	stdout      io.Writer
	stderr      io.Writer
	stdin       io.Reader
}

func New(workingDir, filepath, projectName string) *DockerCompose {
	return &DockerCompose{
		workingDir:  workingDir,
		filepath:    filepath,
		projectName: projectName,
		stdout:      os.Stdout,
		stderr:      os.Stderr,
		stdin:       nil,
	}
}

func NewWithWriters(
	workingDir, filepath, projectName string,
	stdout, stderr io.Writer,
	stdin io.Reader,
) *DockerCompose {
	return &DockerCompose{
		workingDir:  workingDir,
		filepath:    filepath,
		projectName: projectName,
		stdout:      stdout,
		stderr:      stderr,
		stdin:       stdin,
	}
}

func (dc *DockerCompose) WriteComposeFile(composeFile *ComposeFile) error {
	f, err := os.Create(dc.filepath)
	if err != nil {
		return fmt.Errorf("failed to create docker-compose file: %w", err)
	}
	defer f.Close()

	b, err := yaml.Marshal(composeFile)
	if err != nil {
		return fmt.Errorf("failed to marshal docker-compose file: %w", err)
	}

	if _, err := f.Write(b); err != nil {
		return fmt.Errorf("failed to write docker-compose file: %w", err)
	}

	return nil
}

func (dc *DockerCompose) Start(ctx context.Context) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"up",
		"-d", "--wait",
		"--remove-orphans",
	)
	cmd.Stdout = dc.stdout
	cmd.Stdin = dc.stdin

	var stderrBuf bytes.Buffer

	cmd.Stderr = io.MultiWriter(dc.stderr, &stderrBuf)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start docker compose: %w\n%s", err, stderrBuf.String())
	}

	return nil
}

func (dc *DockerCompose) Stop(ctx context.Context, volumes bool) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"down",
	)
	if volumes {
		cmd.Args = append(cmd.Args, "--volumes")
	}

	cmd.Stdout = dc.stdout
	cmd.Stderr = dc.stderr
	cmd.Stdin = dc.stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to stop docker compose: %w", err)
	}

	return nil
}

func (dc *DockerCompose) Logs(ctx context.Context, extraArgs ...string) error {
	args := []string{ //nolint:prealloc
		"compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"logs",
	}
	args = append(args, extraArgs...)

	cmd := exec.CommandContext(
		ctx,
		"docker",
		args...,
	)
	cmd.Stdout = dc.stdout
	cmd.Stderr = dc.stderr
	cmd.Stdin = dc.stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to show logs from docker compose: %w", err)
	}

	return nil
}

func (dc *DockerCompose) Wrapper(ctx context.Context, extraArgs ...string) error {
	args := []string{ //nolint:prealloc
		"compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
	}
	args = append(args, extraArgs...)

	cmd := exec.CommandContext(
		ctx,
		"docker",
		args...,
	)
	cmd.Stdout = dc.stdout
	cmd.Stderr = dc.stderr
	cmd.Stdin = dc.stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to run docker compose: %w", err)
	}

	return nil
}

func (dc *DockerCompose) ApplyMetadata(ctx context.Context, endpoint string) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"exec",
		"console",
		"hasura-cli",
		"metadata", "apply",
		"--endpoint", endpoint,
		"--skip-update-check",
	)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to run docker compose: %w", err)
	}

	return nil
}

func (dc *DockerCompose) ReloadMetadata(ctx context.Context) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"exec",
		"console",
		"hasura-cli",
		"metadata", "reload",
		"--endpoint", "http://graphql:8080",
		"--skip-update-check",
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if n, err := io.Copy(dc.stdout, f); err != nil {
		var pathError *fs.PathError
		switch {
		case errors.As(err, &pathError) && n > 0 && pathError.Op == op:
			// linux pty returns an error when the process exits
			return nil
		default:
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	return nil
}

func (dc *DockerCompose) ApplyMigrations(ctx context.Context, endpoint string) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"exec",
		"console",
		"hasura-cli",
		"migrate",
		"apply",
		"--endpoint", endpoint,
		"--all-databases",
		"--skip-update-check",
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if n, err := io.Copy(dc.stdout, f); err != nil {
		var pathError *fs.PathError
		switch {
		case errors.As(err, &pathError) && n > 0 && pathError.Op == op:
			// linux pty returns an error when the process exits
			return nil
		default:
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	return nil
}

func (dc *DockerCompose) ApplySeeds(ctx context.Context, endpoint string) error {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"exec",
		"console",
		"hasura-cli",
		"seed",
		"apply",
		"--endpoint", endpoint,
		"--all-databases",
		"--skip-update-check",
	)

	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("failed to start pty: %w", err)
	}
	defer f.Close()

	if n, err := io.Copy(dc.stdout, f); err != nil {
		var pathError *fs.PathError
		switch {
		case errors.As(err, &pathError) && n > 0 && pathError.Op == op:
			// linux pty returns an error when the process exits
			return nil
		default:
			return fmt.Errorf("failed to copy pty output: %w", err)
		}
	}

	return nil
}

type ServiceStatus struct {
	Service string `json:"Service"`
	State   string `json:"State"`
	Health  string `json:"Health"`
	Status  string `json:"Status"`
}

func (dc *DockerCompose) PS(ctx context.Context) ([]ServiceStatus, error) {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"ps", "--format", "json", "-a",
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get service status: %w", err)
	}

	return parseServiceStatus(output)
}

func parseServiceStatus(data []byte) ([]ServiceStatus, error) {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return nil, nil
	}

	if data[0] == '[' {
		var services []ServiceStatus
		if err := json.Unmarshal(data, &services); err != nil {
			return nil, fmt.Errorf("failed to parse service status: %w", err)
		}

		return services, nil
	}

	var services []ServiceStatus

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var svc ServiceStatus
		if err := json.Unmarshal([]byte(line), &svc); err != nil {
			continue
		}

		services = append(services, svc)
	}

	return services, nil
}

func (dc *DockerCompose) LogStream(
	ctx context.Context,
	tail int,
) (io.ReadCloser, error) {
	cmd := exec.CommandContext( //nolint:gosec
		ctx,
		"docker", "compose",
		"--project-directory", dc.workingDir,
		"-f", dc.filepath,
		"-p", dc.projectName,
		"logs", "-f",
		"--tail", strconv.Itoa(tail),
		"--no-color",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create log pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start log stream: %w", err)
	}

	return stdout, nil
}
