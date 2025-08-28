#!/usr/bin/env bash

set -euo pipefail

function build_openapi() {
    echo "⚒️⚒️⚒️ Building OpenAPI reference..."
    cp ../packages/nhost-js/api/auth.yaml reference/
    cp ../packages/nhost-js/api/storage.yaml reference/

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

    # Find all files in the directory (recursively)
    find "$folder" -type f | while read -r file; do
        # Check if the file contains the patterns we're looking for
        if grep -q "\.mdx)" "$file" || grep -q "\.mdx#" "$file"; then
            echo "Fixing links in: $file"

            # Create a temporary file
            local temp_file=$(mktemp)

            # Replace .mdx) with ) and .mdx# with #
            sed -e 's/\.mdx)/)/g' -e 's/\.mdx#/#/g' "$file" > "$temp_file"

            # Replace the original file with the fixed version
            mv "$temp_file" "$file"
        fi
    done

    echo "Link fixing complete!"
}

function build_typedoc() {
    echo "⚒️⚒️⚒️ Building TypeDoc documentation..."

    DOCS_DIR=reference/javascript/nhost-js

    typedoc --options typedoc.json --tsconfig ../packages/nhost-js/tsconfig.json

    mv $DOCS_DIR/index.mdx $DOCS_DIR/main.mdx

    fix_mdx_links $DOCS_DIR
}

build_openapi
build_typedoc
