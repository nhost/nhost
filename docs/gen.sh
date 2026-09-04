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

function build_rustdoc() {
	echo "⚒️⚒️⚒️ Building Rust SDK documentation..."

	DOCS_DIR=src/content/docs/reference/rust/nhost-rust
	RUST_PKG=../packages/nhost-rust
	DOC_JSON="$RUST_PKG/target/doc/nhost.json"
	WASM_DOC_JSON="$RUST_PKG/target/wasm32-unknown-unknown/doc/nhost.json"

	# In the docs check both rustdoc JSON files are staged by preCheck from the
	# prebuilt nhost-rust-doc package, so only the Node transformer runs and no
	# cargo is needed. A plain local checkout generates whichever inputs are
	# missing. If neither input nor cargo exists, retain the committed pages.
	if [ ! -f "$DOC_JSON" ] || [ ! -f "$WASM_DOC_JSON" ]; then
		if [ ! -d "$RUST_PKG" ] || ! command -v cargo >/dev/null 2>&1; then
			if [ ! -f "$DOC_JSON" ] && [ ! -f "$WASM_DOC_JSON" ]; then
				echo "⚒️⚒️⚒️ Skipping Rust SDK documentation (no rustdoc JSON / cargo)"
				return 0
			fi
			echo "Error: incomplete Rust SDK documentation artifacts and cargo is unavailable" >&2
			return 1
		fi

		# rustdoc's JSON output is behind `-Z unstable-options`;
		# RUSTC_BOOTSTRAP=1 enables it on the stable toolchain.
		if [ ! -f "$DOC_JSON" ]; then
			(cd "$RUST_PKG" && RUSTC_BOOTSTRAP=1 cargo rustdoc --lib -- \
				-Z unstable-options --output-format json >/dev/null)
		fi
		if [ ! -f "$WASM_DOC_JSON" ]; then
			if ! (cd "$RUST_PKG" && RUSTC_BOOTSTRAP=1 cargo rustdoc --lib \
				--target wasm32-unknown-unknown --no-default-features --features wasm -- \
				-Z unstable-options --output-format json >/dev/null); then
				echo "Error: wasm rustdoc generation failed; install the wasm32-unknown-unknown target or use the Nix dev shell" >&2
				return 1
			fi
		fi
	fi

	node rustdoc-to-md.mjs "$DOC_JSON" "$DOCS_DIR" "$WASM_DOC_JSON"
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
build_rustdoc
build_cli_docs
build_config_reference
