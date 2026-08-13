// Package e2e contains black-box end-to-end tests for the CLI-managed local
// development environment. The tests are guarded by the `e2e` build tag and are
// driven by environment variables; see e2e_test.go for details and how to run
// them. This file exists (untagged) so the package always has a buildable Go
// file, keeping `go build ./...` and linters happy when the tag is absent.
package e2e
