#!/usr/bin/env bash
set -euo pipefail

# Cache outputs reachable from recorded derivations and explicitly recorded
# source roots. Never scan path-info --all: runners may have unrelated stores.
if [ ! -s "$ROOTS_FILE" ]; then
  echo "No Nix cache roots recorded"
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

derivation_roots=()
: > "$work/sources"
while IFS= read -r root; do
  [ -n "$root" ] || continue
  if [[ "$root" == *.drv ]]; then
    derivation_roots+=("$root")
  elif nix-store --check-validity "$root" > /dev/null 2>&1; then
    printf '%s\n' "$root" >> "$work/sources"
  fi
done < "$ROOTS_FILE"

: > "$work/realized"
if [ ${#derivation_roots[@]} -gt 0 ]; then
  # include-outputs finds realized intermediates even when the top-level build
  # failed. Intersect with declared outputs to omit incidental evaluation trees
  # and .drv files, then retain runtime references of selected outputs below.
  nix-store --query --requisites --include-outputs "${derivation_roots[@]}" | sort -u > "$work/reachable"
  grep '\.drv$' "$work/reachable" > "$work/derivations"
  xargs nix-store --query --outputs < "$work/derivations" | sort -u > "$work/outputs"
  comm -12 "$work/reachable" "$work/outputs" > "$work/realized"
fi
cat "$work/sources" >> "$work/realized"
sort -u -o "$work/realized" "$work/realized"
if [ ! -s "$work/realized" ]; then
  echo "No realized Nix roots to cache"
  exit 0
fi

# Newer Nix deprecates implicit JSON formats; older installers do not accept
# --json-format. Probe once without a pipe (grep's early exit can cause EPIPE).
path_info_help=$(NIX_PAGER='cat' nix path-info --help)
case "$path_info_help" in
  *--json-format*) export NIX_JSON_FORMAT=1 ;;
  *) export NIX_JSON_FORMAT=legacy ;;
esac
nix_path_info() {
  if [ "$NIX_JSON_FORMAT" = 1 ]; then
    nix path-info --json --json-format 1 "$@"
  else
    nix path-info --json "$@"
  fi
}
export -f nix_path_info

nix_path_info --recursive --stdin < "$work/realized" > "$work/info.json"
# Retry our own signed paths too: an earlier interrupted upload may have signed
# a path without publishing it. Do not mirror paths signed by upstream caches.
key_name=${NIX_CACHE_PRIV_KEY%%:*}
jq -r --arg prefix "$key_name:" '
  to_entries[]
  | select(.key | endswith(".drv") | not)
  | select((.value.signatures | length == 0) or
      any(.value.signatures[]; startswith($prefix)))
  | .key
' "$work/info.json" > "$work/candidates"
count=$(wc -l < "$work/candidates" | tr -d '[:space:]')
echo "[discover] Found $count workflow-related paths to check"
if [ "$count" -eq 0 ]; then
  exit 0
fi

# R2 uses static keys; OIDC's session token would break SigV4 signing.
unset AWS_SESSION_TOKEN
export S3_BUCKET="nhost-nix-cache"
export S3_REGION="auto"
export S3_ENDPOINT="https://14bc02755b64adb7c8c62b5420d0a457.eu.r2.cloudflarestorage.com"

cache_missing() {
  local store_path="$1"
  local log
  log=$(mktemp)
  if aws s3api head-object --bucket "$S3_BUCKET" \
    --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION" \
    --key "$(basename "$store_path" | cut -d- -f1).narinfo" > /dev/null 2> "$log"; then
    rm -f "$log"
  elif grep -Eq '\(404\)|Not Found|NoSuchKey' "$log"; then
    rm -f "$log"
    echo "$store_path"
  else
    cat "$log" >&2
    rm -f "$log"
    return 1
  fi
}
export -f cache_missing
# Use a checked command, not process substitution: xargs/authentication failures
# must fail the action rather than being mistaken for an empty upload set.
xargs -P 16 -I{} bash -c "cache_missing \"\$1\"" _ {} \
  < "$work/candidates" > "$work/missing"
missing=$(wc -l < "$work/missing" | tr -d '[:space:]')
echo "[check] Found $missing/$count paths missing from cache"
if [ "$missing" -eq 0 ]; then
  exit 0
fi

# Only sign paths we actually upload. Keep private key material out of command
# strings (including the caller's GitHub expression expansion).
printf '%s\n' "$NIX_CACHE_PRIV_KEY" > "$work/key"
chmod 600 "$work/key"
xargs nix store sign --key-file "$work/key" < "$work/missing"

upload_to_s3() {
  set -euo pipefail
  local store_path="$1"
  local start
  start=$(date +%s)
  local store_hash
  store_hash=$(basename "$store_path" | cut -d- -f1)
  local info
  info=$(nix_path_info "$store_path")
  local nar_hash_sri
  nar_hash_sri=$(echo "$info" | jq -r '.[].narHash')
  local nar_hash
  nar_hash=$(nix hash convert --to nix32 "$nar_hash_sri")
  local nar_size
  nar_size=$(echo "$info" | jq -r '.[].narSize')
  local refs
  refs=$(echo "$info" | jq -r '[.[].references[] | split("/")[-1]] | join(" ")')
  local sigs
  sigs=$(echo "$info" | jq -r '.[].signatures[]')

  # This variable outlives the function so the child shell's EXIT trap can
  # remove the archive after the function returns as well as on failure.
  tmp_nar=$(mktemp)
  trap 'rm -f "$tmp_nar"' EXIT
  nix nar pack "$store_path" | zstd -q > "$tmp_nar"
  local file_size
  file_size=$(wc -c < "$tmp_nar" | tr -d '[:space:]')
  local file_hash
  file_hash=$(nix-hash --type sha256 --base32 --flat "$tmp_nar")
  aws s3 cp "$tmp_nar" "s3://${S3_BUCKET}/nar/${file_hash}.nar.zst" \
    --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION" --quiet

  local narinfo
  narinfo="StorePath: ${store_path}
URL: nar/${file_hash}.nar.zst
Compression: zstd
FileHash: sha256:${file_hash}
FileSize: ${file_size}
NarHash: sha256:${nar_hash}
NarSize: ${nar_size}
References: ${refs}"
  local sig
  while IFS= read -r sig; do
    [ -z "$sig" ] || narinfo="${narinfo}
Sig: ${sig}"
  done <<< "$sigs"
  printf '%s\n' "$narinfo" | aws s3 cp - "s3://${S3_BUCKET}/${store_hash}.narinfo" \
    --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION" --quiet
  echo "Uploaded $(basename "$store_path") (nar_size=$nar_size file_size=$file_size total=$(( $(date +%s) - start ))s)"
}
export -f upload_to_s3
xargs -P 4 -I{} bash -c "upload_to_s3 \"\$1\"" _ {} < "$work/missing"
echo "[upload] Uploaded $missing workflow-related paths"
