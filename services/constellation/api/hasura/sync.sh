#!/usr/bin/env bash
#
# Re-sync api/hasura/metadata.openapi.json from the vendored upstream copy
# at third-party/hasura/graphql-engine/metadata.openapi.json and re-apply the
# local scrubs required for oapi-codegen / kin-openapi to parse it.
#
# The scrubs are documented in api/hasura/PATCHES.md.
#
# Run after pulling a new vendored Hasura graphql-engine. After this finishes,
# run `go generate ./...` from the service root to regenerate api/hasura/.

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
upstream="${script_dir}/../../../../../third-party/hasura/graphql-engine/metadata.openapi.json"
dest="${script_dir}/metadata.openapi.json"

if [[ ! -f "${upstream}" ]]; then
	echo "error: upstream not found: ${upstream}" >&2
	exit 1
fi

cp -- "${upstream}" "${dest}"

python3 - "${dest}" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path) as f:
    d = json.load(f)

# 1. Remove `maximum: <Float64.MaxValue>` entries (kin-openapi overflows on
#    them; `minimum: 0` with no upper bound is semantically equivalent).
# 2. Replace standalone `{"type": "null"}` schemas with `{}` (oapi-codegen
#    cannot model `type: null` as a primitive type in OpenAPI 3.0).
# 3. Remove `{"type": "null"}` members from anyOf / oneOf / allOf for the
#    same reason.
# 4. De-duplicate anyOf / oneOf / allOf members (Hasura emits duplicates,
#    e.g. the same $ref twice, which produces duplicate Go methods).
removed_maximum = 0
replaced_type_null = 0
combinator_null_removed = 0
combinator_dedup_removed = 0

FLOAT64_MAX = 1.7976931348623157e308


def scrub(node, parent=None, key=None):
    global removed_maximum, replaced_type_null
    global combinator_null_removed, combinator_dedup_removed

    if isinstance(node, dict):
        if "maximum" in node and isinstance(node["maximum"], (int, float)):
            if node["maximum"] >= FLOAT64_MAX:
                del node["maximum"]
                removed_maximum += 1

        if node.get("type") == "null" and len(node) == 1:
            if isinstance(parent, (dict, list)):
                parent[key] = {}
                replaced_type_null += 1
                return

        for combinator in ("anyOf", "oneOf", "allOf"):
            if combinator in node and isinstance(node[combinator], list):
                before = len(node[combinator])
                without_null = [
                    x for x in node[combinator]
                    if not (isinstance(x, dict) and x.get("type") == "null")
                ]
                combinator_null_removed += before - len(without_null)

                seen = set()
                deduped = []
                for item in without_null:
                    fingerprint = json.dumps(item, sort_keys=True)
                    if fingerprint in seen:
                        combinator_dedup_removed += 1
                        continue
                    seen.add(fingerprint)
                    deduped.append(item)
                node[combinator] = deduped

        for k, v in list(node.items()):
            scrub(v, node, k)

    elif isinstance(node, list):
        for i, v in enumerate(node):
            scrub(v, node, i)


scrub(d)

with open(path, "w") as f:
    json.dump(d, f, indent=4)

print(f"  removed maximum=Float64Max:           {removed_maximum}")
print(f"  replaced standalone type:null with {{}}: {replaced_type_null}")
print(f"  removed type:null from combinators:   {combinator_null_removed}")
print(f"  deduped combinator members:           {combinator_dedup_removed}")
PY

echo
echo "Wrote ${dest}"
echo "Next: cd $(cd -- "${script_dir}/../.." && pwd) && go generate ./..."
