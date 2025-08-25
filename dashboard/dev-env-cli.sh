#!/usr/bin/env bash

set -euo pipefail

export NHOST_DASHBOARD_VERSION=dashboard:0.0.0-dev
FOLDER="$TMPDIR/nhost-dashboard-e2e"


up() {
    echo "➜ Starting local CLI using locally built dashboard with tag $NHOST_DASHBOARD_VERSION"
    rm -rf "$FOLDER"
    mkdir -p "$FOLDER"
    cd "$FOLDER"
    nhost init
    nhost up --down-on-error
}


down() {
    if [ -d "$FOLDER" ]; then
        echo "➜ Stopping nhost environment"
        cd "$FOLDER"
        nhost down --volumes
    else
        echo "➜ No nhost environment found to stop"
    fi
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
