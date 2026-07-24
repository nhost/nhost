#!/bin/sh
# nhost-install-deps.sh
#
# SHARED, BYTE-IDENTICAL across two repositories — keep both copies in sync:
#   * nhost/be:    services/cd/cmd/installscript/nhost-install-deps.sh   (this file)
#   * nhost/nhost: services/functions/nhost-install-deps.sh
# Each repo pins sha256(this file) in a test; edit one, update the pinned hash,
# and copy the file to the other repo (the hashes must match).
#
# Installs a Nhost functions project's dependencies the SAME way in local
# development (services/functions) and production deploys (services/cd). There
# are no behavior knobs: it always
#   * bootstraps corepack, installing it into a writable prefix when the Node
#     image no longer bundles it (Node >= 25), fetching a pinned packageManager
#     non-interactively;
#   * installs @antfu/ni (no-op where it is already on PATH);
#   * tells pnpm NOT to fail on unapproved dependency build scripts — they are
#     SKIPPED, never run (their output is discarded by the esbuild bundle, and
#     running untrusted postinstall scripts would be a needless supply-chain
#     risk);
#   * does a frozen, workspace-isolated install for reproducibility, which
#     REQUIRES a committed lockfile (errors without one).
#
# The only input is WORK_DIR (the directory holding the project's package.json).
# Anything environment-specific is the caller's job, configured BEFORE calling:
#   * Egress proxy: cd points npm/pnpm at its SSL-bumping squid via `npm config`
#     (proxy + strict-ssl false; pnpm reads the same ~/.npmrc). corepack's own
#     download uses undici and CANNOT traverse the bump, so it is deliberately
#     left to go DIRECT — do NOT set HTTP(S)_PROXY here or corepack will break.
#
# POSIX/busybox sh; needs node + npm on PATH. Uses `~` (not $HOME) so paths
# match node's os.homedir() whether or not HOME is exported.

# Wrapper-runtime versions, pinned here as the single source of truth so a
# function behaves the SAME in dev and prod. services/cd installs these into the
# user's project (its Lambda wrapper.js requires them); services/functions ships
# the same express major in its dev runtime — a parity test there asserts its
# package.json matches NHOST_EXPRESS_VERSION. serverless-http is prod-only
# (Lambda); the dev runtime is a long-lived express server. Bump in lockstep.
NHOST_EXPRESS_VERSION=5.2.1
NHOST_SERVERLESS_HTTP_VERSION=3.0.2

nhost_install_deps() {
	set -eu

	: "${WORK_DIR:?WORK_DIR must be set}"

	# 1. corepack — install into a writable prefix if the image lacks it (>= 25).
	export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
	mkdir -p ~/.nhost-tools/bin
	if ! command -v corepack >/dev/null 2>&1; then
		echo "  corepack not bundled, installing"
		npm install --loglevel=error --no-fund --no-update-notifier \
			--prefix ~/.nhost-tools/corepack corepack@0.34.0
		PATH=~/.nhost-tools/corepack/node_modules/.bin:$PATH
		export PATH
	fi
	corepack enable --install-directory ~/.nhost-tools/bin
	PATH=~/.nhost-tools/bin:$PATH
	export PATH

	# 2. @antfu/ni — install if not already on PATH (present in dev's node_modules).
	if ! command -v nci >/dev/null 2>&1; then
		echo "  @antfu/ni not found, installing"
		npm install --loglevel=error --no-fund --no-update-notifier \
			--prefix ~/.nhost-tools/ni @antfu/ni
		PATH=~/.nhost-tools/ni/node_modules/.bin:$PATH
		export PATH
	fi

	# 3. pnpm: skip (don't run, don't FAIL on) unapproved dep build scripts.
	#    Use the env var, NOT ~/.config/pnpm/config.yaml: pnpm 11.0.x does not
	#    read config.yaml (it returns `undefined` for the setting), so the file
	#    silently fails there — while PNPM_CONFIG_STRICT_DEP_BUILDS is honored by
	#    every pnpm version (10.x, 11.0.x, 11.5.x) and survives --ignore-workspace.
	#    It applies to every later pnpm call in this shell; npm/yarn ignore it.
	export PNPM_CONFIG_STRICT_DEP_BUILDS=false

	# 4. nothing to install without a project manifest (e.g. a zero-dep function).
	if [ ! -f "$WORK_DIR/package.json" ]; then
		echo "  no package.json in $WORK_DIR, skipping dependency install"
		return 0
	fi

	# 5. require a committed lockfile and pick the package-manager-specific
	#    workspace-isolation flag (yarn has no clean per-install equivalent).
	if [ -f "$WORK_DIR/package-lock.json" ]; then
		iso="--no-workspaces"
	elif [ -f "$WORK_DIR/pnpm-lock.yaml" ]; then
		iso="--ignore-workspace"
	elif [ -f "$WORK_DIR/yarn.lock" ]; then
		iso=""
	else
		echo "no lockfile in $WORK_DIR — commit a package-lock.json, pnpm-lock.yaml, or yarn.lock" >&2
		return 1
	fi

	# 6. frozen, workspace-isolated install. nci picks the right command:
	#    npm ci --no-workspaces / pnpm install --frozen-lockfile --ignore-workspace
	#    / yarn install --immutable
	(cd "$WORK_DIR" && nci $iso)
}
