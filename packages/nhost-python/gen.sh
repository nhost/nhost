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
		(cd "$CODEGEN_DIR" && go run . gen "$@")
	fi
}

run_codegen \
	--openapi-file "$REPO_ROOT/services/auth/docs/openapi.yaml" \
	--output-file "$SCRIPT_DIR/src/nhost/auth/client.py" \
	--plugin python

run_codegen \
	--openapi-file "$REPO_ROOT/services/storage/controller/openapi.yaml" \
	--output-file "$SCRIPT_DIR/src/nhost/storage/client.py" \
	--plugin python

# Format the generated output deterministically when ruff is available so the
# committed files match what the Nix idempotence check regenerates.
if command -v ruff >/dev/null 2>&1; then
	ruff format src/nhost/auth/client.py src/nhost/storage/client.py
fi
