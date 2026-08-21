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
	--output-file "$SCRIPT_DIR/src/auth/client.rs" \
	--plugin rust

run_codegen \
	--openapi-file "$REPO_ROOT/services/storage/controller/openapi.yaml" \
	--output-file "$SCRIPT_DIR/src/storage/client.rs" \
	--plugin rust

# rustfmt normalizes the generated output deterministically so the committed
# files match what the Nix idempotence check regenerates.
if command -v rustfmt >/dev/null 2>&1; then
	rustfmt --edition 2021 "$SCRIPT_DIR/src/auth/client.rs" "$SCRIPT_DIR/src/storage/client.rs"
fi
