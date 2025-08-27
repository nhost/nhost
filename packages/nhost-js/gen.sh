#!/bin/sh

set -e

codegen gen \
    --openapi-file ./api/auth.yaml \
    --output-file ./src/auth/client.ts \
    --plugin typescript

pnpm prettier -w ./src/auth/client.ts

codegen gen \
    --openapi-file ./api/storage.yaml \
    --output-file ./src/storage/client.ts \
    --plugin typescript

pnpm prettier -w ./src/storage/client.ts

