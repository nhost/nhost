#!/bin/sh

cp ../packages/nhost-js/api/auth.yaml reference/
cp ../packages/nhost-js/api/storage.yaml reference/

mintlify-openapi openapi \
    --openapi-file reference/auth.yaml \
    --out-dir reference/auth

mintlify-openapi openapi \
    --openapi-file reference/storage.yaml \
    --out-dir reference/storage
