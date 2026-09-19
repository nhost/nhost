#!/bin/sh

set -e

if ! command -v biome >/dev/null 2>&1; then
	echo "error: biome not found; the generated clients must be biome-formatted." >&2
	echo "       run inside 'nix develop .#nhost-js', or install biome." >&2
	exit 1
fi

codegen gen \
    --openapi-file ../../services/auth/docs/openapi.yaml \
    --output-file ./src/auth/client.ts \
    --plugin typescript

codegen gen \
    --openapi-file ../../services/storage/controller/openapi.yaml \
    --output-file ./src/storage/client.ts \
    --plugin typescript

biome format --write ./src/auth/client.ts ./src/storage/client.ts
