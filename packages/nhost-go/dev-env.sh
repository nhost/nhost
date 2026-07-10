#!/usr/bin/env bash

# Bring the local Nhost backend up/down for integration + docstring examples.
# Mirrors packages/nhost-js/dev-env.sh. The backend project lives under
# ./build/backend (committed in this package) and is driven by the nhost CLI.

set -euo pipefail

FOLDER=./build/backend


up() {
    if [ ! -d "$FOLDER" ]; then
        echo "error: $FOLDER not found." >&2
        echo "Run this script from the nhost-go package root." >&2
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
