#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

mkdir -p Sources/Nhost/Generated

codegen gen \
	--openapi-file ../../services/auth/docs/openapi.yaml \
	--output-file Sources/Nhost/Generated/Auth.swift \
	--plugin swift \
	--namespace Auth \
	--client-name AuthClient

codegen gen \
	--openapi-file ../../services/storage/controller/openapi.yaml \
	--output-file Sources/Nhost/Generated/Storage.swift \
	--plugin swift \
	--namespace Storage \
	--client-name StorageClient
