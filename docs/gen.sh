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

function build_postgres_extensions() {
	echo "⚒️⚒️⚒️ Building Postgres extensions documentation..."

	local source=../services/postgres/plugins.md
	local target=src/content/docs/products/database/extensions.mdx
	local start_marker="{/*BEGIN GENERATED POSTGRES EXTENSIONS*/}"
	local end_marker="{/*END GENERATED POSTGRES EXTENSIONS*/}"

	if [ ! -s "$source" ]; then
		echo "Error: '$source' is missing or empty"
		return 1
	fi

	if [ "$(grep -Fxc "$start_marker" "$target" || true)" -ne 1 ] ||
		[ "$(grep -Fxc "$end_marker" "$target" || true)" -ne 1 ]; then
		echo "Error: expected exactly one generated Postgres extensions marker pair in '$target'"
		return 1
	fi

	local temp_file
	temp_file=$(mktemp)

	awk -v source="$source" -v start_marker="$start_marker" -v end_marker="$end_marker" '
		$0 == start_marker {
			print
			print ""
			while ((getline line < source) > 0) {
				print line
			}
			close(source)
			replacing = 1
			next
		}
		$0 == end_marker {
			print ""
			replacing = 0
		}
		!replacing { print }
	' "$target" >"$temp_file"

	mv "$temp_file" "$target"
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

build_schemas
build_postgres_extensions
build_typedoc
build_cli_docs
build_config_reference
