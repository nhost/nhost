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

function build_pydoc() {
    echo "⚒️⚒️⚒️ Building Python SDK documentation..."

    DOCS_DIR=$(pwd)/src/content/docs/reference/python/nhost-python
    SCRIPT=$(pwd)/pydoc-to-md.py
    PY_PKG=../packages/nhost-python

    # pydoc-to-md.py imports `nhost` and introspects it. In the docs check the
    # SDK source is on PYTHONPATH and pydantic/httpx come from the checkDeps
    # python env, so introspect it directly with the plain interpreter. In a
    # local checkout, fall back to the package's uv venv. If neither can import
    # nhost, skip and keep the committed pages — the sha1sum gate passes.
    if PYTHONPATH="$PY_PKG/src" python3 -c "import nhost" >/dev/null 2>&1; then
        PYTHONPATH="$PY_PKG/src" python3 "$SCRIPT" "$DOCS_DIR"
    elif command -v uv >/dev/null 2>&1 && [ -d "$PY_PKG" ]; then
        (cd "$PY_PKG" && uv run python "$SCRIPT" "$DOCS_DIR")
    else
        echo "⚒️⚒️⚒️ Skipping Python SDK documentation (nhost import unavailable)"
    fi
}

function build_cli_docs() {
	echo "⚒️⚒️⚒️ Building CLI documentation..."
	# `cli gen-docs` emits the final MDX directly (badge/<div> wrappers and
	# angle-bracket escaping are handled in internal/lib/clidocs), so no
	# post-processing is needed here.
	cli gen-docs >src/content/docs/reference/cli/commands.mdx
}

build_schemas
build_typedoc
build_pydoc
build_cli_docs
build_config_reference
