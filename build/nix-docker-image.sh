#!/usr/bin/env bash

which nix > /dev/null

if [[ $NIX_BUILD_NATIVE -eq 1 ]]; then
    case $(uname -m) in
    "arm64")
        SYSTEM="aarch64-linux"
        ;;
    *)
        SYSTEM="x86_64-linux"
        ;;
    esac

    nix build .\#packages.${SYSTEM}.dockerImage --print-build-logs && docker load < result
    exit $?
fi

if [[ ( $? -eq 0 ) && ( `uname` == "Linux" ) ]]; then
    nix build .\#dockerImage --print-build-logs && docker load < result
    exit $?
fi


docker run --rm -it \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:/build \
    -w /build \
    --entrypoint sh \
    dbarroso/nix:2.6.0 \
        -c "nix build .\\#dockerImage --print-build-logs && docker load < result"
