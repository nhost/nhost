#!/usr/bin/env bash

# Bring the local Nhost backend up/down for integration + docstring examples.
# Mirrors packages/nhost-js/dev-env.sh. The backend project is the shared
# packages/backend-sdk-tests, used by every SDK's integration suite.

set -euo pipefail

FOLDER=../backend-sdk-tests


up() {
    if [ ! -d "$FOLDER" ]; then
        echo "error: $FOLDER not found (expected the shared testing backend)." >&2
        exit 1
    fi
    cd "$FOLDER"

    if [ ! -f .secrets ]; then
        cp .secrets.example .secrets
    fi

    nhost up --down-on-error
}


down() {
    cd "$FOLDER"
    nhost down --volumes
}


case "${1:-}" in
    "up")
        up
        ;;
    "down")
        down
        ;;
    *)
        echo "Usage: $0 {up|down}"
        exit 1
        ;;
esac
