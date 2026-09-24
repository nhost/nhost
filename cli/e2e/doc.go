// Package e2e tests the CLI-managed local development environment. The
// Docker-suite files e2e_test.go and lifecycle_test.go require the `e2e` build
// tag; command_test.go and redaction_test.go are untagged so their harness unit
// tests run in the ordinary test leg. This file keeps the package buildable
// when the tag is absent.
//
// Hasura CLI can exit successfully after reporting inconsistent metadata, so
// `nhost up` succeeding does not prove that a fixture was accepted. The suite
// copies only metadata the scratch project can satisfy, and the negative
// assertions in TestCopyExampleMetadata pin those exclusions.
package e2e
