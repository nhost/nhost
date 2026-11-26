package transport

// CommandTransport spawns a subprocess and communicates with it over its
// stdin/stdout streams using JSON-RPC messages.
//
// CommandTransport is a thin, convenience wrapper around the Stdio transport
// that makes the subprocess use case explicit and self-documenting. The
// underlying behavior is identical to NewStdio: any options, methods, or
// guarantees provided by Stdio are available here via embedding.
//
// Use CommandTransport when you want to launch an MCP server as a child
// process. Use Stdio (e.g. via NewIO) when you want to attach to existing
// streams.
type CommandTransport struct {
	*Stdio
}

// NewCommand creates a transport that spawns the given command as a subprocess
// and communicates with it over stdin/stdout. The current process's
// environment is inherited by the child.
//
// This is equivalent to calling NewStdio(command, nil, args...) but expresses
// the subprocess intent more clearly.
func NewCommand(command string, args ...string) *CommandTransport {
	return &CommandTransport{Stdio: NewStdio(command, nil, args...)}
}

// NewCommandWithEnv creates a transport that spawns the given command as a
// subprocess with additional environment variables appended to the parent
// process's environment. Each entry in env must be of the form "KEY=VALUE".
//
// This is equivalent to calling NewStdio(command, env, args...).
func NewCommandWithEnv(command string, env []string, args ...string) *CommandTransport {
	return &CommandTransport{Stdio: NewStdio(command, env, args...)}
}

// NewCommandWithOptions creates a transport that spawns the given command as a
// subprocess and applies the provided StdioOptions (for example
// WithCommandFunc or WithCommandLogger) before the subprocess is started.
//
// This is equivalent to calling NewStdioWithOptions(command, env, args, opts...).
func NewCommandWithOptions(command string, env []string, args []string, opts ...StdioOption) *CommandTransport {
	return &CommandTransport{Stdio: NewStdioWithOptions(command, env, args, opts...)}
}
