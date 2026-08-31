#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

REPO_ROOT=$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)
CODEGEN_DIR="$REPO_ROOT/tools/codegen"

run_codegen() {
	if command -v codegen >/dev/null 2>&1; then
		codegen gen "$@"
	else
		(cd "$CODEGEN_DIR" && GOFLAGS=-mod=mod go run . gen "$@")
	fi
}

run_codegen \
	--openapi-file "$REPO_ROOT/services/auth/docs/openapi.yaml" \
	--output-file "$SCRIPT_DIR/auth/client.go" \
	--plugin go \
	--package auth

run_codegen \
	--openapi-file "$REPO_ROOT/services/storage/controller/openapi.yaml" \
	--output-file "$SCRIPT_DIR/storage/client.go" \
	--plugin go \
	--package storage

# goimports prunes the superset import block emitted by the template (adding or
# removing stdlib imports as each spec requires) and formats deterministically,
# so the committed files match what the Nix idempotence check regenerates.
if command -v goimports >/dev/null 2>&1; then
	goimports -w "$SCRIPT_DIR/auth/client.go" "$SCRIPT_DIR/storage/client.go"
else
	gofmt -w "$SCRIPT_DIR/auth/client.go" "$SCRIPT_DIR/storage/client.go"
fi
