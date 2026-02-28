#!/bin/sh

set -e

codegen gen \
    --openapi-file ../../services/auth/docs/openapi.yaml \
    --output-file ./src/auth/client.ts \
    --plugin typescript

codegen gen \
    --openapi-file ../../services/storage/controller/openapi.yaml \
    --output-file ./src/storage/client.ts \
    --plugin typescript

