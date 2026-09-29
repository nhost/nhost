// Package serve owns the shared process runtime for the Nhost service binaries
// and the unified engine. Run builds Definitions, composes their handlers on
// one public HTTP listener, runs background work, then drains the listener,
// cancels background work and closes services in reverse order within one
// shutdown budget. The optional debug address serves http.DefaultServeMux on
// a separate best-effort listener. Each Service owns only its own resources.
//
// The package never installs signal handlers: Run responds to cancellation of
// its context, and the caller decides what cancels it. NewLogger and LogFlags
// provide shared startup logging with secrets redacted.
package serve
