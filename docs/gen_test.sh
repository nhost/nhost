#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck disable=SC1091
source "$script_dir/gen.sh"

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

source_file="$temp_dir/plugins.md"
target_file="$temp_dir/extensions.mdx"
expected_file="$temp_dir/expected.mdx"

cat >"$source_file" <<'EOF'
| Name | Version | Description |
| ---- | ------- | ----------- |
| example|1.0|Supports <widgets>, {expressions}, A | B & entities|
EOF

cat >"$target_file" <<'EOF'
before
{/*BEGIN GENERATED POSTGRES EXTENSIONS*/}
stale content
{/*END GENERATED POSTGRES EXTENSIONS*/}
after
EOF

cat >"$expected_file" <<'EOF'
before
{/*BEGIN GENERATED POSTGRES EXTENSIONS*/}

| Name | Version | Description |
| ---- | ------- | ----------- |
| example|1.0|Supports &lt;widgets&gt;, &#123;expressions&#125;, A &#124; B &amp; entities|

{/*END GENERATED POSTGRES EXTENSIONS*/}
after
EOF

build_postgres_extensions "$source_file" "$target_file" >/dev/null
diff -u "$expected_file" "$target_file"
