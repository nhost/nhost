#!/usr/bin/env bash

set -euo pipefail

FOLDER=./build/backend


up() {
    cd $FOLDER

    if [ ! -f .secrets ]; then
        cp .secrets.example .secrets
    fi

    nhost up --down-on-error
}


down() {
    cd $FOLDER
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
