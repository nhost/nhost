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

	# Also serve the specs as files from docs.nhost.io/openapi/, not just as
	# rendered reference pages.
	mkdir -p public/openapi
	for spec in auth storage; do
		cp "src/schemas/${spec}.yaml" "public/openapi/${spec}.yaml"
		# JSON too: its content type doesn't depend on the host's mime table,
		# and most OpenAPI tooling prefers it.
		node -e "
		  const yaml = require('js-yaml'), fs = require('fs');
		  const spec = yaml.load(fs.readFileSync('src/schemas/${spec}.yaml', 'utf8'));
		  fs.writeFileSync('public/openapi/${spec}.json', JSON.stringify(spec, null, 2) + '\n');
		"
	done
}

function build_graphql_schemas() {
	echo "⚒️⚒️⚒️ Publishing GraphQL schemas..."
	# The same Cloud schema the CLI's MCP server embeds, served from
	# docs.nhost.io/graphql/ for agents that aren't running the CLI.
	mkdir -p public/graphql
	cp ../cli/mcp/resources/cloud_schema.graphql public/graphql/cloud.graphql
	cp ../cli/mcp/resources/cloud_schema-with-mutations.graphql \
		public/graphql/cloud-with-mutations.graphql
}

function build_postgres_extensions() {
	echo "⚒️⚒️⚒️ Building Postgres extensions documentation..."

	local source="${1:-../services/postgres/plugins.md}"
	local target="${2:-src/content/docs/products/database/extensions.mdx}"
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

	local start_marker_line
	start_marker_line=$(grep -Fnx "$start_marker" "$target" | cut -d: -f1)
	local end_marker_line
	end_marker_line=$(grep -Fnx "$end_marker" "$target" | cut -d: -f1)
	if ((end_marker_line <= start_marker_line)); then
		echo "Error: generated Postgres extensions end marker must follow its start marker in '$target'"
		return 1
	fi

	local temp_file
	temp_file=$(mktemp)

	awk -v source="$source" -v start_marker="$start_marker" -v end_marker="$end_marker" '
		function escape_mdx(value) {
			gsub(/&/, "\\&amp;", value)
			gsub(/</, "\\&lt;", value)
			gsub(/>/, "\\&gt;", value)
			gsub(/[{]/, "\\&#123;", value)
			gsub(/[}]/, "\\&#125;", value)
			gsub(/[|]/, "\\&#124;", value)
			return value
		}

		function escape_table_row(line, columns, column_count, description, i) {
			column_count = split(line, columns, "[|]")
			if (column_count < 5 || columns[1] != "" || columns[column_count] != "") {
				return escape_mdx(line)
			}

			# The first two separators delimit name and version; later pipes belong to the description.
			description = columns[4]
			for (i = 5; i < column_count; i++) {
				description = description "|" columns[i]
			}

			return "|" escape_mdx(columns[2]) "|" escape_mdx(columns[3]) "|" escape_mdx(description) "|"
		}

		$0 == start_marker {
			print
			print ""
			while ((getline line < source) > 0) {
				print escape_table_row(line)
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

	cat "$temp_file" >"$target"
	rm -f "$temp_file"
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

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	build_schemas
	build_graphql_schemas
	build_postgres_extensions
	build_typedoc
	build_cli_docs
	build_config_reference
fi
