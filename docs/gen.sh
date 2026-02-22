#!/usr/bin/env bash

set -euo pipefail

fix_md_links() {
    local folder="$1"

    if [ ! -d "$folder" ]; then
        echo "Error: '$folder' is not a valid directory"
        return 1
    fi

    echo "Processing files in $folder..."

    # Find all MDX files in the directory (recursively)
    find "$folder" -name "*.md" -type f | while read -r file; do
        echo "Processing: $file"

        # Create a temporary file
        local temp_file=$(mktemp)

        # Replace .md) with ) and .md# with #, ensure relative paths start with ./, and remove one level of headers
        sed -e 's/\.md)/)/g' -e 's/\.md#/#/g' -e 's/\[\([^]]*\)\](\([^./#][^)]*\))/[\1](\.\/\2)/g' -e 's/^#//' "$file" > "$temp_file"

        # Replace the original file with the fixed version
        mv "$temp_file" "$file"
    done

    echo "Link fixing complete!"
}

add_frontmatter() {
    local folder="$1"

    if [ ! -d "$folder" ]; then
        echo "Error: '$folder' is not a valid directory"
        return 1
    fi

    echo "Adding frontmatter to files in $folder..."

    find "$folder" -name "*.md" -type f | while read -r file; do
        # Skip files that already have frontmatter
        if head -1 "$file" | grep -q '^---$'; then
            continue
        fi

        local basename=$(basename "$file" .md)
        # Capitalize first letter for title
        local title="$(echo "$basename" | sed 's/.*/\u&/')"

        local temp_file=$(mktemp)
        {
            echo "---"
            echo "title: ${title}"
            echo "---"
            echo ""
            cat "$file"
        } > "$temp_file"
        mv "$temp_file" "$file"
    done

    echo "Frontmatter complete!"
}

function build_schemas() {
    echo "⚒️⚒️⚒️ Building schemas documentation..."
    cp ../services/storage/controller/openapi.yaml src/schemas/storage.yaml
    cp ../services/auth/docs/openapi.yaml src/schemas/auth.yaml
}


function build_typedoc() {
    echo "⚒️⚒️⚒️ Building TypeDoc documentation..."

    DOCS_DIR=src/content/docs/reference/javascript/nhost-js

    pnpm exec typedoc --options typedoc.json --tsconfig ../packages/nhost-js/tsconfig.json

    mv $DOCS_DIR/index.md $DOCS_DIR/main.md
    rm $DOCS_DIR/.md

    fix_md_links $DOCS_DIR
    add_frontmatter $DOCS_DIR
}

function build_cli_docs() {
    echo "⚒️⚒️⚒️ Building CLI documentation..."
    cli gen-docs > src/content/docs/reference/cli/commands.mdx
    cat src/content/docs/reference/cli/commands.mdx

    sed -i 's/</\&lt;/g; s/>/\&gt;/g' src/content/docs/reference/cli/commands.mdx
}

build_schemas
build_typedoc
build_cli_docs
