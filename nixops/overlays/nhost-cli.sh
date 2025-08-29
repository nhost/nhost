#!/usr/bin/env bash

set -eou pipefail

# --- Configuration ---
REPO_OWNER="nhost"
REPO_NAME="cli"

# Determine the directory where this script is located
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Path to the Nix file to update, relative to this script's directory
NIX_FILE="${SCRIPT_DIR}/nhost-cli.nix" # Make sure this path is correct

# --- Helper functions ---
get_latest_version() {
  local latest_tag
  if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI 'gh' not found. Please install it and run 'gh auth login'." >&2
    return 1
  fi
  if ! gh auth status &> /dev/null; then
    echo "Warning: GitHub CLI 'gh' is not authenticated. Attempting anonymous API call via gh." >&2
    echo "For higher rate limits, please run 'gh auth login'." >&2
  fi
  echo "Fetching latest version using 'gh api'..." >&2
  latest_tag=$(gh api "repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" --jq '.tag_name' 2>/dev/null)
  if [ -z "$latest_tag" ]; then
    echo "Error: Could not fetch or parse the latest version tag using 'gh api'." >&2
    echo "Command was: gh api \"repos/${REPO_OWNER}/${REPO_NAME}/releases/latest\" --jq '.tag_name'" >&2
    gh api "repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" >&2 || true
    return 1
  fi
  echo "$latest_tag"
}

get_current_version() {
  local current_ver
  current_ver=$(grep 'version = "' "$NIX_FILE" | sed -E 's/.*version = "([^"]+)".*/\1/')
  if [ -z "$current_ver" ]; then
    echo "Error: Could not read current version from $NIX_FILE." >&2
    return 1
  fi
  echo "$current_ver"
}

get_platform_hashes() {
  local version_tag="$1"

  if [ -z "$version_tag" ]; then
    echo "Error: No version provided to get_platform_hashes function." >&2
    return 1
  fi

  if ! command -v nix-prefetch-url &> /dev/null; then
      echo "Error: nix-prefetch-url command not found. Please ensure it's in your PATH." >&2
      return 1
  fi

  echo "Prefetching hashes for version $version_tag in parallel..." >&2

  local platforms_and_suffixes=(
    "darwin-arm64"  # aarch64-darwin
    "darwin-amd64"  # x86_64-darwin
    "linux-arm64"   # aarch64-linux
    "linux-amd64"   # x86_64-linux
  )

  local pids=()
  local temp_files=()
  # Ensure temporary files are cleaned up on exit, error, or interrupt
  # The trap needs to be able to access the temp_files array
  # For simplicity, declare temp_files globally accessible *within this function's scope*
  # or pass it to a cleanup function. Here, we'll define cleanup here.
  cleanup_temp_files() {
    if [ ${#temp_files[@]} -gt 0 ]; then
      echo "Cleaning up temporary hash files..." >&2
      rm -f "${temp_files[@]}"
    fi
  }
  trap cleanup_temp_files EXIT SIGINT SIGTERM

  for suffix in "${platforms_and_suffixes[@]}"; do
    local url="https://github.com/nhost/cli/releases/download/${version_tag}/cli-${version_tag}-${suffix}.tar.gz"
    local temp_file
    temp_file=$(mktemp --tmpdir nhost-hash-prefetch.XXXXXX)
    temp_files+=("$temp_file")

    echo "  Starting prefetch for: $url (output to $temp_file)" >&2
    # Run nix-prefetch-url in a subshell in the background
    # The subshell ensures that 'exit 1' on failure affects the background job, not the main script
    ( nix-prefetch-url --quiet --type sha256 "$url" > "$temp_file" || exit 1 ) &
    pids+=($!) # Store PID of the background process
  done

  local fetched_hashes=()
  local all_ok=true
  echo "Waiting for all prefetch jobs to complete..." >&2
  for i in "${!pids[@]}"; do
    local pid="${pids[$i]}"
    local suffix="${platforms_and_suffixes[$i]}" # For better error messages
    if wait "$pid"; then
      echo "  Prefetch job for ${suffix} (PID: $pid) completed successfully." >&2
    else
      echo "Error: Prefetch job for ${suffix} (PID: $pid) failed." >&2
      all_ok=false
      # We can choose to continue waiting for others or break early
      # For now, let all attempt to finish to see all errors.
    fi
  done

  if ! "$all_ok"; then
    echo "Error: One or more hash prefetching jobs failed." >&2
    # Cleanup is handled by trap
    return 1
  fi

  echo "All prefetch jobs completed. Reading hashes..." >&2
  for i in "${!temp_files[@]}"; do
    local temp_file="${temp_files[$i]}"
    local suffix="${platforms_and_suffixes[$i]}" # For context
    local hash_val
    hash_val=$(cat "$temp_file")
    if [ -z "$hash_val" ]; then
      echo "Error: Fetched hash is empty for ${suffix} from file $temp_file." >&2
      all_ok=false # Mark as not okay
      break # No point continuing if one hash is bad
    fi
    fetched_hashes+=("$hash_val")
  done

  # Explicitly call cleanup here, trap will also run on exit
  cleanup_temp_files
  trap - EXIT SIGINT SIGTERM # Remove the trap as we've cleaned up

  if ! "$all_ok"; then
      echo "Error: Failed to read one or more hashes from temporary files." >&2
      return 1
  fi

  if [ ${#fetched_hashes[@]} -ne ${#platforms_and_suffixes[@]} ]; then
      echo "Error: Number of fetched hashes (${#fetched_hashes[@]}) does not match expected (${#platforms_and_suffixes[@]})." >&2
      return 1
  fi

  # Print hashes one per line for mapfile, in the correct order
  printf "%s\n" "${fetched_hashes[@]}"
}


# --- Sanity Checks ---
if [ ! -f "$NIX_FILE" ]; then
  echo "Error: Nix definition file not found at $NIX_FILE" >&2
  exit 1
fi

# --- Main logic ---
echo "Fetching latest version for ${REPO_OWNER}/${REPO_NAME}..."
LATEST_VERSION=$(get_latest_version) || exit 1
echo "Latest version available: $LATEST_VERSION"

CURRENT_VERSION=$(get_current_version) || exit 1
echo "Current version in $NIX_FILE: $CURRENT_VERSION"

if [ "$LATEST_VERSION" == "$CURRENT_VERSION" ]; then
  echo "nhost-cli is already up-to-date (version $CURRENT_VERSION). Nothing to do."
  exit 0
fi

echo "New version available. Updating from $CURRENT_VERSION to $LATEST_VERSION..."

HASHES_STR=$(get_platform_hashes "$LATEST_VERSION")
if [ $? -ne 0 ]; then
    echo "Error: Failed to get platform hashes for version $LATEST_VERSION." >&2
    exit 1
fi
mapfile -t HASHES <<< "$HASHES_STR"


if [ ${#HASHES[@]} -ne 4 ]; then
    echo "Error: Expected 4 hashes, but got ${#HASHES[@]}." >&2
    echo "Output received:" >&2
    printf '%s\n' "${HASHES[@]}" >&2
    exit 1
fi

NEW_SHA_AARCH64_DARWIN="${HASHES[0]}"
NEW_SHA_X86_64_DARWIN="${HASHES[1]}"
NEW_SHA_AARCH64_LINUX="${HASHES[2]}"
NEW_SHA_X86_64_LINUX="${HASHES[3]}"

for hash_val in "$NEW_SHA_AARCH64_DARWIN" "$NEW_SHA_X86_64_DARWIN" "$NEW_SHA_AARCH64_LINUX" "$NEW_SHA_X86_64_LINUX"; do
  if ! [[ "$hash_val" =~ ^[a-z0-9]{52}$ ]]; then
    echo "Error: A fetched hash ('$hash_val') does not look like a valid Nix SRI SHA256 hash (expected 52 base32 chars)." >&2
    echo "Hashes received: " >&2
    printf '%s\n' "${HASHES[@]}" >&2
    exit 1
  fi
done

echo "New Hashes:"
echo "  aarch64-darwin: $NEW_SHA_AARCH64_DARWIN"
echo "  x86_64-darwin:  $NEW_SHA_X86_64_DARWIN"
echo "  aarch64-linux:  $NEW_SHA_AARCH64_LINUX"
echo "  x86_64-linux:   $NEW_SHA_X86_64_LINUX"

echo "Updating $NIX_FILE..."

cp "$NIX_FILE" "${NIX_FILE}.bak"
echo "Backup created at ${NIX_FILE}.bak"

TMP_NIX_FILE=$(mktemp)
# Ensure main temporary file is cleaned up on exit, error, or interrupt
# Note: The trap for hash temp files is local to get_platform_hashes
trap 'rm -f "$TMP_NIX_FILE" "$TMP_NIX_FILE.tmp"' EXIT SIGINT SIGTERM
cp "$NIX_FILE" "$TMP_NIX_FILE"

sed -E "s/(version\s*=\s*\")[^\"]+(\";)/\1$LATEST_VERSION\2/" "$TMP_NIX_FILE" > "$TMP_NIX_FILE.tmp" && mv "$TMP_NIX_FILE.tmp" "$TMP_NIX_FILE"
sed -E "/aarch64-darwin\s*=\s*\{/,/sha256\s*=/s/(sha256\s*=\s*\")[a-z0-9]+(\";)/\1$NEW_SHA_AARCH64_DARWIN\2/" "$TMP_NIX_FILE" > "$TMP_NIX_FILE.tmp" && mv "$TMP_NIX_FILE.tmp" "$TMP_NIX_FILE"
sed -E "/x86_64-darwin\s*=\s*\{/,/sha256\s*=/s/(sha256\s*=\s*\")[a-z0-9]+(\";)/\1$NEW_SHA_X86_64_DARWIN\2/" "$TMP_NIX_FILE" > "$TMP_NIX_FILE.tmp" && mv "$TMP_NIX_FILE.tmp" "$TMP_NIX_FILE"
sed -E "/aarch64-linux\s*=\s*\{/,/sha256\s*=/s/(sha256\s*=\s*\")[a-z0-9]+(\";)/\1$NEW_SHA_AARCH64_LINUX\2/" "$TMP_NIX_FILE" > "$TMP_NIX_FILE.tmp" && mv "$TMP_NIX_FILE.tmp" "$TMP_NIX_FILE"
sed -E "/x86_64-linux\s*=\s*\{/,/sha256\s*=/s/(sha256\s*=\s*\")[a-z0-9]+(\";)/\1$NEW_SHA_X86_64_LINUX\2/" "$TMP_NIX_FILE" > "$TMP_NIX_FILE.tmp" && mv "$TMP_NIX_FILE.tmp" "$TMP_NIX_FILE"

mv "$TMP_NIX_FILE" "$NIX_FILE"
# Trap for $TMP_NIX_FILE will clean up after successful mv, or if mv fails.

echo "Successfully updated $NIX_FILE to version $LATEST_VERSION."
echo "Please review the changes and commit them."
echo "You can diff with: git diff $NIX_FILE"
echo "Or compare with the backup: diff \"${NIX_FILE}.bak\" \"$NIX_FILE\""
