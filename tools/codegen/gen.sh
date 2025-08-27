#!/bin/sh

set -e

go run main.go gen \
    --openapi-file ../../packages/nhost-js/api/auth.yaml \
    --output-file ../../packages/nhost-js/src/auth/client.ts \
    --plugin typescript


go run main.go gen \
    --openapi-file ../../packages/nhost-js/api/storage.yaml \
    --output-file ../../packages/nhost-js/src/storage/client.ts \
    --plugin typescript
