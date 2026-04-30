#!/bin/sh
set -euo pipefail

# * Enable corepack so it manages pnpm/yarn versions from the packageManager field
mkdir -p /tmp/corepack-shims
corepack enable --install-directory /tmp/corepack-shims

# * Set the default package manager to use if cannot be guessed from lock files
echo "defaultAgent=$PACKAGE_MANAGER" > ~/.nirc


# * Look for the package.json file.
# * If not found, create it in the "functions" directory.
if [ -f "./functions/package.json" ]; then
    # * ./functions/package.json exists
    FUNCTIONS_WORKING_DIR=./functions
    FUNCTIONS_RELATIVE_PATH=.
else
    # * ./functions/package.json DOES NOT exist
    if [ -f "./package.json" ]; then
        # * ./package.json exists
        FUNCTIONS_WORKING_DIR=.
        FUNCTIONS_RELATIVE_PATH=./functions
    else
        # * ./package.json DOES NOT exist"
        mkdir -p functions
        cd functions
        npm init -y 1> /dev/null
        cd ..
        FUNCTIONS_WORKING_DIR=./functions
        FUNCTIONS_RELATIVE_PATH=.
    fi
fi

# if neither package-lock.json nor yarn.lock exists nor pnpm-lock.yaml, error
if [ ! -f "$FUNCTIONS_WORKING_DIR/package-lock.json" ] && [ ! -f "$FUNCTIONS_WORKING_DIR/yarn.lock" ] && [ ! -f "$FUNCTIONS_WORKING_DIR/pnpm-lock.yaml" ]; then
    echo "No lock file found. Please commit your lock file for npm, yarn, or pnpm"
    exit 1
fi

# * Create a default tsconfig.json file in the functions' working directory.
cp -n "$SERVER_PATH/tsconfig.json" "$FUNCTIONS_WORKING_DIR/tsconfig.json"

# * Install dependencies and start the server from the functions working directory
# * (cwd must be FUNCTIONS_WORKING_DIR so FUNCTIONS_RELATIVE_PATH resolves correctly)
# * NODE_OPTIONS bumps the V8 heap so esbuild's watch context has headroom for
# * projects with many functions / heavy deps. Override via env if needed.
: "${NODE_OPTIONS:=--max-old-space-size=4096}"
export NODE_OPTIONS

cd "$FUNCTIONS_WORKING_DIR" && nci && \
FUNCTIONS_RELATIVE_PATH="$FUNCTIONS_RELATIVE_PATH" \
node "$SERVER_PATH/server.js"
