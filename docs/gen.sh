#!/bin/sh

mintlify-openapi openapi \
    --openapi-file ../packages/nhost-js/api/auth.yaml \
    --out-dir reference/auth

mintlify-openapi openapi \
    --openapi-file ../packages/nhost-js/api/storage.yaml \
    --out-dir reference/storage
