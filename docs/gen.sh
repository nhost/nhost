#!/usr/bin/env bash

set -euo pipefail

function build_openapi() {
    echo "⚒️⚒️⚒️ Building OpenAPI reference..."
    cp ../services/auth/docs/openapi.yaml reference/auth.yaml
    cp ../services/storage/controller/openapi.yaml reference/storage.yaml


    echo "⚒️⚒️⚒️ Generating documentation from OpenAPI specs for Auth service..."
    mintlify-openapi openapi \
        --openapi-file reference/auth.yaml \
        --out-dir reference/auth

    echo "⚒️⚒️⚒️ Generating documentation from OpenAPI specs for Storage service..."
    mintlify-openapi openapi \
        --openapi-file reference/storage.yaml \
        --out-dir reference/storage
}

fix_mdx_links() {
    local folder="$1"

    if [ ! -d "$folder" ]; then
        echo "Error: '$folder' is not a valid directory"
        return 1
    fi

    echo "Processing files in $folder..."

    # Find all MDX files in the directory (recursively)
    find "$folder" -name "*.mdx" -type f | while read -r file; do
        echo "Processing: $file"

        # Create a temporary file
        local temp_file=$(mktemp)

        # Replace .mdx) with ) and .mdx# with #, ensure relative paths start with ./, and remove one level of headers
        sed -e 's/\.mdx)/)/g' -e 's/\.mdx#/#/g' -e 's/\[\([^]]*\)\](\([^./#][^)]*\))/[\1](\.\/\2)/g' -e 's/^#//' "$file" > "$temp_file"

        # Replace the original file with the fixed version
        mv "$temp_file" "$file"
    done

    echo "Link fixing complete!"
}

function build_typedoc() {
    echo "⚒️⚒️⚒️ Building TypeDoc documentation..."

    DOCS_DIR=reference/javascript/nhost-js

    pnpm exec typedoc --options typedoc.json --tsconfig ../packages/nhost-js/tsconfig.json

    mv $DOCS_DIR/index.mdx $DOCS_DIR/main.mdx
    rm $DOCS_DIR/.mdx

    fix_mdx_links $DOCS_DIR
}

function build_cli_docs() {
    echo "⚒️⚒️⚒️ Building CLI documentation..."
    cli docs > reference/cli/commands.mdx
}

build_openapi
build_typedoc
build_cli_docs
