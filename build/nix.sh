#!/usr/bin/env bash

which nix > /dev/null

if [ $? -eq 0 ]; then
    nix $@
    exit $?
fi

docker run --rm -it \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:/build \
    -w /build \
    --entrypoint nix \
    dbarroso/nix:2.6.0 \
        "$@"
