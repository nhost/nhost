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
		sed -e 's/\.md)/)/g' -e 's/\.md#/#/g' -e 's/\[\([^]]*\)\](\([^./#][^)]*\))/[\1](\.\/\2)/g' -e 's/^#//' "$file" >"$temp_file"

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
		} >"$temp_file"
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

function build_config_reference() {
	echo "⚒️⚒️⚒️ Building configuration reference..."
	(
		cd ..
		go run ./tools/configdocs \
			-schema vendor/github.com/nhost/be/services/mimir/schema/schema.cue \
			-out docs/src/content/docs/reference/configuration/index.mdx
	)
}

function build_cli_docs() {
	echo "⚒️⚒️⚒️ Building CLI documentation..."
	# `cli gen-docs` emits the final MDX directly (badge/<div> wrappers and
	# angle-bracket escaping are handled in internal/lib/clidocs), so no
	# post-processing is needed here.
	cli gen-docs >src/content/docs/reference/cli/commands.mdx
}

function build_godoc() {
    echo "⚒️⚒️⚒️ Building Go SDK documentation..."

    DOCS_DIR=$(pwd)/src/content/docs/reference/go/nhost-go

    # The generator parses the SDK packages with go/doc and emits the markdown
    # reference pages. In the docs check (and devShell) it's the prebuilt
    # godoc-md Nix binary on PATH, so no Go toolchain is needed there; in a
    # plain local checkout fall back to `go run`. If neither is available
    # (e.g. the SDK source isn't checked out), skip and keep the committed
    # pages — the sha1sum freshness gate then passes unchanged.
    if command -v godoc-md >/dev/null 2>&1; then
        (cd .. && godoc-md packages/nhost-go "$DOCS_DIR")
    elif command -v go >/dev/null 2>&1 && [ -d ../tools/godoc-md ]; then
        (cd .. && go run ./tools/godoc-md packages/nhost-go "$DOCS_DIR")
    else
        echo "⚒️⚒️⚒️ Skipping Go SDK documentation (godoc-md/go unavailable)"
    fi
}

build_godoc
build_schemas
build_typedoc
build_cli_docs
build_config_reference
