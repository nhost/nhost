#!/bin/sh

set -euo pipefail

mkdir -p /clamav

envsubst < /etc/clamav/freshclam.conf.tmpl > /etc/clamav/freshclam.conf
envsubst < /etc/clamav/clamd.conf.tmpl > /etc/clamav/clamd.conf

# we run freshclam first to download the database
freshclam
# we start the freshclam daemon
freshclam -d &
pid1=$!

# we start the clamd daemon
clamd &
pid2=$!

# Loop until either process finishes
while true; do
    if kill -0 $pid1 >/dev/null 2>&1; then
        if kill -0 $pid2 >/dev/null 2>&1; then
            sleep 5
        else
            kill $pid1
            break
        fi
    else
        kill $pid2
        break
    fi
done

exit 1
