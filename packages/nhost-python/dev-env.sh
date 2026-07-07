#!/usr/bin/env bash

# Bring the local Nhost backend up/down for integration + docstring examples.
# Mirrors packages/nhost-js/dev-env.sh. The backend project under ./build/backend
# is still to be added (part of the pending flake/backend wiring); until then
# this script points at where it should live and fails with a clear message.

set -euo pipefail

FOLDER=./build/backend


up() {
    if [ ! -d "$FOLDER" ]; then
        echo "error: $FOLDER not found." >&2
        echo "The local backend project has not been added yet (pending task)." >&2
        echo "Copy the layout from packages/nhost-js/build/backend and retry." >&2
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
