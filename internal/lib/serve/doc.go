// Package serve holds the process runtime shared by the Nhost service binaries
// (auth, storage, constellation) and the unified engine binary, so these
// concerns are defined once instead of copy-pasted into every cmd package.
//
// A Manager is the entry point: each service is added to it as a Definition, a
// name plus a BuildFunc, and Manager.Run builds them, serves their handlers on
// one or more listeners, runs their background work, and tears the whole
// process down in order within a single shutdown budget. A Service owns only
// what it built — its handler, its background work, and the release of its own
// dependencies — while the Manager owns the lifecycle around them. How several
// handlers share a listener is the caller's decision, given through
// WithHandler. The package never installs signal handlers: Run responds to
// cancellation of the context it is given, and the caller's main decides what
// cancels it, typically signal.NotifyContext on SIGINT and SIGTERM.
//
// The package also holds the logging every binary shares: NewLogger for the
// handler configuration and LogFlags for startup flag records with secrets
// redacted.
package serve
