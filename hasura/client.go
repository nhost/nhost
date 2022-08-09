package hasura

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"syscall"

	"github.com/nhost/cli/nhost"
)

type RequestBody struct {
	Type    string      `json:"type"`
	Version uint        `json:"version,omitempty"`
	Args    interface{} `json:"args"`
}

type HttpDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type Client struct {
	Endpoint               string
	AdminSecret            string
	Client                 HttpDoer
	CLI                    string
	CommonOptions          []string
	CommonOptionsWithoutDB []string
}

func (r *RequestBody) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

func InitClient(endpoint, adminSecret string, httpClient HttpDoer) (*Client, error) {
	c := &Client{}
	err := c.Init(endpoint, adminSecret, httpClient)
	return c, err
}

func (c *Client) Request(body []byte, path string) (*http.Response, error) {

	req, err := http.NewRequest(
		http.MethodPost,
		c.Endpoint+path,
		bytes.NewBuffer(body),
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Hasura-Admin-Secret", c.AdminSecret)

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.Client.Do(req)
}

//  Initialize the client with supplied Hasura endpoint,
//  admin secret and a custom HTTP client.
func (c *Client) Init(endpoint, adminSecret string, client HttpDoer) error {

	log.Debug("Initializing Hasura client")

	//  Prepare and load required binaries
	cli, err := Binary()
	if err != nil {
		return err
	}

	c.CLI = cli
	c.Endpoint = endpoint
	c.AdminSecret = adminSecret
	c.CommonOptions = []string{
		"--endpoint", c.Endpoint,
		"--admin-secret", c.AdminSecret,
		"--database-name", nhost.DATABASE,
		"--skip-update-check",
	}
	c.CommonOptionsWithoutDB = []string{
		"--endpoint", c.Endpoint,
		"--admin-secret", c.AdminSecret,
		"--skip-update-check",
	}

	if client == nil {
		c.Client = &http.Client{}
	} else {
		c.Client = client
	}

	return nil
}

func (c *Client) RunConsoleCmd(ctx context.Context, consolePort, consoleAPIPort uint32, debug bool) *exec.Cmd {
	args := append([]string{"console", "--no-browser", "--console-port", fmt.Sprint(consolePort), "--api-port", fmt.Sprint(consoleAPIPort)}, c.CommonOptionsWithoutDB...)
	cmd := exec.CommandContext(ctx, c.CLI, args...)
	cmd.Dir = nhost.NHOST_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	setCmdDebugStreams(cmd, debug)

	return cmd
}

func (c *Client) ApplyMetadata(ctx context.Context, debug bool) error {
	args := append([]string{"metadata", "apply"}, c.CommonOptionsWithoutDB...)
	cmd := exec.CommandContext(ctx, c.CLI, args...)
	cmd.Dir = nhost.NHOST_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	setCmdDebugStreams(cmd, debug)

	return cmd.Run()
}

func (c *Client) ApplyMigrations(ctx context.Context, debug bool) error {
	args := append([]string{"migrate", "apply", "--disable-interactive"}, c.CommonOptions...)
	cmd := exec.CommandContext(ctx, c.CLI, args...)
	cmd.Dir = nhost.NHOST_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	setCmdDebugStreams(cmd, debug)

	return cmd.Run()
}

func (c *Client) ApplySeed(ctx context.Context, debug bool) error {
	args := append([]string{"seed", "apply", "--disable-interactive"}, c.CommonOptions...)
	cmd := exec.CommandContext(ctx, c.CLI, args...)
	cmd.Dir = nhost.NHOST_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	setCmdDebugStreams(cmd, debug)

	return cmd.Run()
}

func (c *Client) ExportMetadata(ctx context.Context, debug bool) error {
	args := append([]string{"metadata", "export"}, c.CommonOptionsWithoutDB...)
	cmd := exec.CommandContext(ctx, c.CLI, args...)
	cmd.Dir = nhost.NHOST_DIR
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	setCmdDebugStreams(cmd, debug)

	return cmd.Run()
}

func setCmdDebugStreams(cmd *exec.Cmd, debug bool) {
	if debug {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
}
