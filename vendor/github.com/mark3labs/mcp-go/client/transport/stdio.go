package transport

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

var (
	// ErrTransportClosed is returned when attempting to send a request or notification
	// to a transport that has already been closed.
	ErrTransportClosed = errors.New("transport closed")
	// ErrChildShutdownTimeout is returned when a stdio subprocess still has not exited
	// after the forced shutdown path has been attempted.
	ErrChildShutdownTimeout = errors.New("stdio child did not exit after forced shutdown")
)

// Stdio implements the transport layer of the MCP protocol using stdio communication.
// It launches a subprocess and communicates with it via standard input/output streams
// using JSON-RPC messages. The client handles message routing between requests and
// responses, and supports asynchronous notifications.
type Stdio struct {
	command string
	args    []string
	env     []string

	cmd              *exec.Cmd
	cmdFunc          CommandFunc
	stdin            io.WriteCloser
	stdinMu          sync.Mutex
	stdout           *bufio.Reader
	stderr           io.ReadCloser
	stderrWriter     io.Writer
	stderrRing       *stderrBuffer
	responses        map[string]chan *JSONRPCResponse
	mu               sync.RWMutex
	done             chan struct{}
	closeOnce        sync.Once
	closeCleanupOnce sync.Once
	onNotification   func(mcp.JSONRPCNotification)
	notifyMu         sync.RWMutex
	onRequest        RequestHandler
	requestMu        sync.RWMutex
	ctx              context.Context
	ctxMu            sync.RWMutex
	logger           *slog.Logger
	started          bool
	startedMu        sync.Mutex
	resourcesReady   bool // guarded by startedMu
}

const (
	gracefulShutdownTimeout = 2 * time.Second
	forceKillTimeout        = 3 * time.Second

	// stderrBufferSize bounds how much recent stderr output the transport
	// keeps available through Stderr(). The OS pipe itself is only ~64KB, so
	// a larger buffer would not add fidelity once the child outruns readers.
	stderrBufferSize = 64 * 1024
)

// stderrBuffer is a bounded, drop-oldest buffer of the subprocess's stderr
// output. The transport writes into it continuously so the OS pipe never
// fills up and blocks the child, while callers can still read recent stderr
// through Stderr(). Reads block until data is available or the stream ends.
type stderrBuffer struct {
	mu   sync.Mutex
	cond *sync.Cond
	buf  bytes.Buffer
	done bool
}

// newStderrBuffer returns an empty, open stderr buffer ready for writing.
func newStderrBuffer() *stderrBuffer {
	b := &stderrBuffer{}
	b.cond = sync.NewCond(&b.mu)
	return b
}

// Write appends p to the buffer, dropping the oldest data when the buffer is
// full. It never blocks, so a child writing to stderr can never deadlock the
// transport.
func (b *stderrBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.done {
		return 0, io.ErrClosedPipe
	}
	// Report the original length per the io.Writer contract even when the
	// tail truncation below drops the leading bytes.
	written := len(p)
	if len(p) > stderrBufferSize {
		p = p[len(p)-stderrBufferSize:]
	}
	if overflow := b.buf.Len() + len(p) - stderrBufferSize; overflow > 0 {
		b.buf.Next(overflow)
	}
	b.buf.Write(p)
	b.cond.Broadcast()
	return written, nil
}

// Read returns buffered data, blocking until data is available or the stream
// is marked done.
func (b *stderrBuffer) Read(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for b.buf.Len() == 0 && !b.done {
		b.cond.Wait()
	}
	if b.buf.Len() == 0 {
		return 0, io.EOF
	}
	return b.buf.Read(p)
}

// Close marks the stream as ended and wakes up blocked readers.
func (b *stderrBuffer) Close() error {
	b.mu.Lock()
	b.done = true
	b.cond.Broadcast()
	b.mu.Unlock()
	return nil
}

func waitForProcessExit(waitErrCh <-chan error, timeout time.Duration) (error, bool) {
	select {
	case err := <-waitErrCh:
		return err, true
	case <-time.After(timeout):
		return nil, false
	}
}

// StdioOption defines a function that configures a Stdio transport instance.
// Options can be used to customize the behavior of the transport before it starts,
// such as setting a custom command function.
type StdioOption func(*Stdio)

// CommandFunc is a factory function that returns a custom exec.Cmd used to launch the MCP subprocess.
// It can be used to apply sandboxing, custom environment control, working directories, etc.
type CommandFunc func(ctx context.Context, command string, env []string, args []string) (*exec.Cmd, error)

// WithCommandFunc sets a custom command factory function for the stdio transport.
// The CommandFunc is responsible for constructing the exec.Cmd used to launch the subprocess,
// allowing control over attributes like environment, working directory, and system-level sandboxing.
func WithCommandFunc(f CommandFunc) StdioOption {
	return func(s *Stdio) {
		s.cmdFunc = f
	}
}

// WithCommandLogger sets a custom structured logger for the stdio transport.
// A nil logger falls back to slog.Default().
func WithCommandLogger(logger *slog.Logger) StdioOption {
	return func(s *Stdio) {
		if logger == nil {
			s.logger = slog.Default()
			return
		}
		s.logger = logger
	}
}

// WithCommandStderrWriter sets the destination for the subprocess's stderr
// output. The default destination is io.Discard: the transport drains stderr
// continuously so that the OS pipe (about 64KB) can never fill up and block
// the child process, which would deadlock the whole stdio channel.
// Pass os.Stderr, a log file, or an in-memory buffer to capture the child's
// stderr instead.
func WithCommandStderrWriter(w io.Writer) StdioOption {
	return func(s *Stdio) {
		s.stderrWriter = w
	}
}

// NewStdio creates a new stdio transport to communicate with a subprocess.
// It launches the specified command with given arguments and sets up stdin/stdout pipes for communication.
// Returns an error if the subprocess cannot be started or the pipes cannot be created.
func NewStdio(
	command string,
	env []string,
	args ...string,
) *Stdio {
	return NewStdioWithOptions(command, env, args)
}

// NewStdioWithOptions creates a new stdio transport to communicate with a subprocess.
// It launches the specified command with given arguments and sets up stdin/stdout pipes for communication.
// Returns an error if the subprocess cannot be started or the pipes cannot be created.
// Optional configuration functions can be provided to customize the transport before it starts,
// such as setting a custom command factory.
func NewStdioWithOptions(
	command string,
	env []string,
	args []string,
	opts ...StdioOption,
) *Stdio {
	s := &Stdio{
		command: command,
		args:    args,
		env:     env,

		responses: make(map[string]chan *JSONRPCResponse),
		done:      make(chan struct{}),
		ctx:       context.Background(),
		logger:    slog.Default(),
	}

	for _, opt := range opts {
		opt(s)
	}

	return s
}

// NewIO returns a new stdio-based transport using existing input, output, and
// logging streams instead of spawning a subprocess.
// This is useful for testing and simulating client behavior.
func NewIO(input io.Reader, output io.WriteCloser, logging io.ReadCloser) *Stdio {
	return &Stdio{
		stdin:          output,
		stdout:         bufio.NewReader(input),
		stderr:         logging,
		resourcesReady: true,

		responses: make(map[string]chan *JSONRPCResponse),
		done:      make(chan struct{}),
		ctx:       context.Background(),
		logger:    slog.Default(),
	}
}

func (c *Stdio) Start(ctx context.Context) error {
	c.startedMu.Lock()
	select {
	case <-c.done:
		c.startedMu.Unlock()
		return ErrTransportClosed
	default:
	}
	if c.started {
		c.startedMu.Unlock()
		return nil
	}
	c.started = true
	c.startedMu.Unlock()

	// Store the context for use in request handling
	c.ctxMu.Lock()
	c.ctx = ctx
	c.ctxMu.Unlock()

	if err := c.spawnCommand(ctx); err != nil {
		c.startedMu.Lock()
		c.started = false
		c.startedMu.Unlock()
		return err
	}
	select {
	case <-c.done:
		return errors.Join(ErrTransportClosed, c.Close())
	default:
	}

	ready := make(chan struct{})
	go func() {
		c.readResponses(ready)
	}()
	<-ready

	return nil
}

// spawnCommand spawns a new process running the configured command, args, and env.
// If an (optional) cmdFunc custom command factory function was configured, it will be used to construct the subprocess;
// otherwise, the default behavior uses exec.CommandContext with the merged environment.
// Initializes stdin, stdout, and stderr pipes for JSON-RPC communication.
func (c *Stdio) spawnCommand(ctx context.Context) error {
	if c.command == "" {
		return nil
	}

	var cmd *exec.Cmd
	var err error

	// Standard behavior if no command func present.
	if c.cmdFunc == nil {
		cmd = exec.CommandContext(ctx, c.command, c.args...)
		cmd.Env = append(os.Environ(), c.env...)
	} else if cmd, err = c.cmdFunc(ctx, c.command, c.env, c.args); err != nil {
		return err
	}
	select {
	case <-c.done:
		return ErrTransportClosed
	default:
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Respect a stderr destination configured by a custom command factory;
	// otherwise capture stderr so it can be drained below.
	var stderr io.ReadCloser
	if cmd.Stderr == nil {
		stderr, err = cmd.StderrPipe()
		if err != nil {
			return fmt.Errorf("failed to create stderr pipe: %w", err)
		}
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start command: %w", err)
	}

	var ring *stderrBuffer
	if stderr != nil {
		ring = newStderrBuffer()
	}
	c.startedMu.Lock()
	c.cmd = cmd
	c.stdin = stdin
	c.stderr = stderr
	c.stdout = bufio.NewReader(stdout)
	c.stderrRing = ring
	c.resourcesReady = true
	c.startedMu.Unlock()

	// Drain stderr continuously so the subprocess can never deadlock on a
	// full pipe, including when Close wins the race with resource publication.
	if stderr != nil {
		go drainStderrIntoRing(ring, stderr, c.stderrWriter, c.logger)
	}
	return nil
}

// drainStderrIntoRing copies src into the ring buffer until the stream ends,
// closing the ring afterwards to wake readers blocked in Stderr().Read.
//
// The drain must never stop while the child runs: a full OS pipe blocks the
// child inside write(2) and deadlocks every request. When dest is nil the
// stream is drained directly into the ring without any mirroring overhead;
// otherwise mirroring is decoupled through a bounded queue so a failing or
// blocked writer cannot stop the pipe drain: once the queue fills up (or the
// mirror goroutine exits) further chunks are dropped and the loss is logged
// at debug level. The mirror goroutine is intentionally not waited for: a
// writer stuck inside Write would otherwise delay ring Close and leave
// Stderr() readers blocked.
func drainStderrIntoRing(ring *stderrBuffer, src io.ReadCloser, dest io.Writer, logger *slog.Logger) {
	defer func() {
		_ = ring.Close()
	}()

	// No custom destination configured: drain directly without spawning a
	// mirror goroutine or allocating mirror chunks.
	if dest == nil {
		_, _ = io.Copy(ring, src)
		return
	}

	mirror := make(chan []byte, 8)
	go func() {
		for chunk := range mirror {
			if _, err := dest.Write(chunk); err != nil {
				return
			}
		}
	}()

	buf := make([]byte, 32*1024)
	for {
		n, rerr := src.Read(buf)
		if n > 0 {
			if _, werr := ring.Write(buf[:n]); werr != nil {
				break
			}
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			select {
			case mirror <- chunk:
			default:
				// Mirror is full or gone; dropping the
				// chunk keeps the pipe draining.
				if logger != nil {
					logger.Debug("stderr mirror queue full; dropping chunk", "bytes", n)
				}
			}
		}
		if rerr != nil {
			break
		}
	}
	close(mirror)
}

// closeDone safely closes the done channel exactly once, unblocking all
// in-flight SendRequest calls. Safe to call from multiple goroutines.
func (c *Stdio) closeDone() {
	c.closeOnce.Do(func() { close(c.done) })
}

// Close shuts down the stdio client, closing the stdin pipe and waiting for the subprocess to exit.
// Returns an error if there are issues closing stdin or waiting for the subprocess to terminate.
// Safe to call multiple times and concurrently with readResponses calling closeDone().
func (c *Stdio) Close() error {
	// Signal all in-flight requests to unblock.
	c.closeDone()
	c.startedMu.Lock()
	resourcesReady := c.resourcesReady
	c.startedMu.Unlock()
	if !resourcesReady {
		// A pending Start will clean up any resources it publishes after Close.
		return nil
	}

	// Perform resource cleanup exactly once, even if readResponses already
	// called closeDone() (e.g. server died). Without this, the old early-return
	// guard would skip stdin/stderr cleanup and cmd.Wait(), causing FD leaks
	// and zombie processes.
	var closeErr error
	c.closeCleanupOnce.Do(func() {
		if c.stdin != nil {
			if err := c.stdin.Close(); err != nil {
				closeErr = fmt.Errorf("failed to close stdin: %w", err)
			}
		}
		if c.stderr != nil {
			if err := c.stderr.Close(); err != nil && closeErr == nil {
				closeErr = fmt.Errorf("failed to close stderr: %w", err)
			}
		}
		if c.cmd != nil {
			waitErrCh := make(chan error, 1)
			go func() {
				waitErrCh <- c.cmd.Wait()
			}()

			if err, done := waitForProcessExit(waitErrCh, gracefulShutdownTimeout); done {
				if err != nil && closeErr == nil {
					closeErr = err
				}
				return
			}

			forceKilled := false
			if c.cmd.Process != nil {
				// SIGTERM is not implemented on Windows. Kill immediately after
				// the graceful stdin-close wait so Close does not spend an
				// extra forceKillTimeout waiting for a signal that never lands.
				if runtime.GOOS == "windows" {
					if err := c.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) && closeErr == nil {
						closeErr = fmt.Errorf("failed to kill process: %w", err)
					}
					forceKilled = true
				} else {
					_ = c.cmd.Process.Signal(syscall.SIGTERM)
				}
			}

			if err, done := waitForProcessExit(waitErrCh, forceKillTimeout); done {
				if err != nil && closeErr == nil {
					closeErr = err
				}
				return
			}

			if forceKilled {
				if closeErr == nil {
					closeErr = ErrChildShutdownTimeout
				}
				return
			}

			if c.cmd.Process != nil {
				if err := c.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) && closeErr == nil {
					closeErr = fmt.Errorf("failed to kill process: %w", err)
				}
			}

			if err, done := waitForProcessExit(waitErrCh, forceKillTimeout); done {
				if err != nil && closeErr == nil {
					closeErr = err
				}
			} else if closeErr == nil {
				closeErr = ErrChildShutdownTimeout
			}
		}
	})
	return closeErr
}

// GetSessionId returns the session ID of the transport.
// Since stdio does not maintain a session ID, it returns an empty string.
func (c *Stdio) GetSessionId() string {
	return ""
}

// SetNotificationHandler sets the handler function to be called when a notification is received.
// Only one handler can be set at a time; setting a new one replaces the previous handler.
// A handler may replace or remove itself; the change applies to subsequent notifications.
func (c *Stdio) SetNotificationHandler(
	handler func(notification mcp.JSONRPCNotification),
) {
	c.notifyMu.Lock()
	defer c.notifyMu.Unlock()
	c.onNotification = handler
}

// SetRequestHandler sets the handler function to be called when a request is received from the server.
// This enables bidirectional communication for features like sampling.
func (c *Stdio) SetRequestHandler(handler RequestHandler) {
	c.requestMu.Lock()
	defer c.requestMu.Unlock()
	c.onRequest = handler
}

// readResponses continuously reads and processes responses from the server's stdout.
// It handles both responses to requests and notifications, routing them appropriately.
// Runs until the done channel is closed or an error occurs reading from stdout.
// The ready channel, if non-nil, is closed once the read loop is entered, signaling
// to Start() that the transport is actively processing responses.
func (c *Stdio) readResponses(ready chan struct{}) {
	var lastLine bool
	for {
		// Signal readiness on the first iteration, inside the loop, so that
		// Start() only unblocks after the reader is actively processing.
		if ready != nil {
			close(ready)
			ready = nil
		}
		select {
		case <-c.done:
			return
		default:
			if lastLine {
				c.closeDone()
				return
			}
			line, err := c.stdout.ReadString('\n')
			// The final message may arrive without a trailing newline.
			if err == io.EOF && strings.TrimSpace(line) != "" {
				lastLine, err = true, nil
			}
			if err != nil {
				if err != io.EOF && !errors.Is(err, context.Canceled) && !errors.Is(err, fs.ErrClosed) {
					c.logger.Error("Error reading from stdout", "err", err)
				}
				// Signal done so in-flight SendRequest calls unblock
				// instead of hanging forever when the server dies.
				c.closeDone()
				return
			}

			line = strings.TrimRight(line, "\r\n")
			// First try to parse as a generic message to check for ID field
			var baseMessage struct {
				JSONRPC string         `json:"jsonrpc"`
				ID      *mcp.RequestId `json:"id,omitempty"`
				Method  string         `json:"method,omitempty"`
			}
			if err := json.Unmarshal([]byte(line), &baseMessage); err != nil {
				continue
			}

			// If it has a method but no ID, it's a notification
			if baseMessage.Method != "" && baseMessage.ID == nil {
				var notification mcp.JSONRPCNotification
				if err := json.Unmarshal([]byte(line), &notification); err != nil {
					continue
				}
				c.notifyMu.RLock()
				handler := c.onNotification
				c.notifyMu.RUnlock()
				if handler != nil {
					handler(notification)
				}
				continue
			}

			// If it has a method and an ID, it's an incoming request
			if baseMessage.Method != "" && baseMessage.ID != nil {
				var request JSONRPCRequest
				if err := json.Unmarshal([]byte(line), &request); err == nil {
					c.handleIncomingRequest(request)
					continue
				}
			}

			// Otherwise, it's a response to our request
			var response JSONRPCResponse
			if err := json.Unmarshal([]byte(line), &response); err != nil {
				continue
			}

			// Create string key for map lookup
			idKey := response.ID.String()

			c.mu.RLock()
			ch, exists := c.responses[idKey]
			c.mu.RUnlock()

			if exists {
				ch <- &response
				c.mu.Lock()
				delete(c.responses, idKey)
				c.mu.Unlock()
			}
		}
	}
}

// SendRequest sends a JSON-RPC request to the server and waits for a response.
// It creates a unique request ID, sends the request over stdin, and waits for
// the corresponding response or context cancellation.
// Returns the raw JSON response message or an error if the request fails.
func (c *Stdio) SendRequest(
	ctx context.Context,
	request JSONRPCRequest,
) (*JSONRPCResponse, error) {
	// Check if transport is closed or context is already canceled before doing any work
	select {
	case <-c.done:
		return nil, ErrTransportClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if c.stdin == nil {
		return nil, fmt.Errorf("stdio client not started")
	}

	// Marshal request
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	requestBytes = append(requestBytes, '\n')

	// Create string key for map lookup
	idKey := request.ID.String()

	// Register response channel
	responseChan := make(chan *JSONRPCResponse, 1)
	c.mu.Lock()
	c.responses[idKey] = responseChan
	c.mu.Unlock()
	deleteResponseChan := func() {
		c.mu.Lock()
		delete(c.responses, idKey)
		c.mu.Unlock()
	}

	// Send request. stdinMu serializes frame writes so concurrent
	// SendRequest/SendNotification/sendResponse calls cannot interleave
	// JSON-RPC lines on the subprocess's stdin.
	c.stdinMu.Lock()
	_, err = c.stdin.Write(requestBytes)
	c.stdinMu.Unlock()
	if err != nil {
		deleteResponseChan()
		return nil, fmt.Errorf("failed to write request: %w", err)
	}

	select {
	case <-c.done:
		// Drain responseChan first: a valid response may have been delivered
		// just before readResponses closed the done channel on EOF.
		select {
		case response := <-responseChan:
			return response, nil
		default:
		}
		deleteResponseChan()
		return nil, ErrTransportClosed
	case <-ctx.Done():
		deleteResponseChan()
		return nil, ctx.Err()
	case response := <-responseChan:
		return response, nil
	}
}

// SendNotification sends a json RPC Notification to the server.
func (c *Stdio) SendNotification(
	ctx context.Context,
	notification mcp.JSONRPCNotification,
) error {
	select {
	case <-c.done:
		return ErrTransportClosed
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if c.stdin == nil {
		return fmt.Errorf("stdio client not started")
	}

	notificationBytes, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}
	notificationBytes = append(notificationBytes, '\n')

	c.stdinMu.Lock()
	_, err = c.stdin.Write(notificationBytes)
	c.stdinMu.Unlock()
	if err != nil {
		return fmt.Errorf("failed to write notification: %w", err)
	}

	return nil
}

// handleIncomingRequest processes incoming requests from the server.
// It calls the registered request handler and sends the response back to the server.
func (c *Stdio) handleIncomingRequest(request JSONRPCRequest) {
	c.requestMu.RLock()
	handler := c.onRequest
	c.requestMu.RUnlock()

	if handler == nil {
		// Send error response if no handler is configured
		errorResponse := *NewJSONRPCErrorResponse(
			request.ID,
			mcp.METHOD_NOT_FOUND,
			"No request handler configured",
			nil,
		)
		c.sendResponse(errorResponse)
		return
	}

	// Handle the request in a goroutine to avoid blocking
	go func() {
		c.ctxMu.RLock()
		ctx := c.ctx
		c.ctxMu.RUnlock()

		// Check if context is already cancelled before processing
		select {
		case <-ctx.Done():
			errorResponse := *NewJSONRPCErrorResponse(request.ID, mcp.INTERNAL_ERROR, ctx.Err().Error(), nil)
			c.sendResponse(errorResponse)
			return
		default:
		}

		response, err := handler(ctx, request)
		if err != nil {
			errorResponse := *NewJSONRPCErrorResponse(request.ID, mcp.INTERNAL_ERROR, err.Error(), nil)
			c.sendResponse(errorResponse)
			return
		}

		if response != nil {
			c.sendResponse(*response)
		}
	}()
}

// sendResponse sends a response back to the server.
func (c *Stdio) sendResponse(response JSONRPCResponse) {
	responseBytes, err := json.Marshal(response)
	if err != nil {
		c.logger.Error("Error marshaling response", "err", err)
		return
	}
	responseBytes = append(responseBytes, '\n')

	c.stdinMu.Lock()
	_, err = c.stdin.Write(responseBytes)
	c.stdinMu.Unlock()
	if err != nil {
		c.logger.Error("Error writing response", "err", err)
	}
}

// Stderr returns a reader for the stderr output of the subprocess.
// This can be used to capture error messages or logs from the subprocess.
//
// The transport drains the subprocess's stderr into a bounded buffer so the
// OS pipe never fills up and deadlocks the child. The reader returns the most
// recent output; older output is dropped once the buffer is full. To capture
// the full, real-time stream, use WithCommandStderrWriter instead.
func (c *Stdio) Stderr() io.Reader {
	if c.stderrRing != nil {
		return c.stderrRing
	}
	return c.stderr
}
