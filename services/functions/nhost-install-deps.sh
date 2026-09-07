#!/bin/sh
# nhost-install-deps.sh
#
# SHARED, BYTE-IDENTICAL across two repositories — keep both copies in sync:
#   * nhost/be:    services/cd/cmd/installscript/nhost-install-deps.sh
#   * nhost/nhost: services/functions/nhost-install-deps.sh
# Each repo pins sha256(this file) in a test; edit one, update the pinned hash,
# and copy the file to the other repo (the hashes must match).
#
# Installs a Nhost functions project's dependencies the SAME way in local
# development (services/functions) and production deploys (services/cd). There
# are no behavior knobs: no project or dependency lifecycle script ever runs,
# pnpm .pnpmfile.cjs hooks and project yarn-path binaries are ignored, and Yarn
# Berry projects are rejected before bootstrap. The install remains frozen and
# REQUIRES a committed lockfile. The function also bootstraps corepack into a
# writable prefix when Node no longer bundles it (Node >= 25).
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
NHOST_SERVERLESS_HTTP_VERSION=4.0.0

nhost_install_deps() {
	set -eu

	: "${WORK_DIR:?WORK_DIR must be set}"

	# 1. Block every install-time user-code path before any bootstrap or return.
	#    Probes on the production Node images verified npm's env beats .npmrc;
	#    pnpm 11.0.6's dedicated env beats pnpm-workspace.yaml and .npmrc; and
	#    Yarn classic's dedicated env beats .yarnrc. Yarn classic ignores the npm
	#    setting, so every package manager keeps its own explicit control.
	export npm_config_ignore_scripts=true
	export PNPM_CONFIG_IGNORE_SCRIPTS=true
	export PNPM_CONFIG_IGNORE_PNPMFILE=true
	export YARN_IGNORE_SCRIPTS=true
	export YARN_ENABLE_SCRIPTS=false
	export YARN_IGNORE_PATH=1

	export COREPACK_ENV_FILE=0

	#    corepack refuses URL/file packageManager specs unless this is 1; pin it
	#    so a caller's environment cannot enable that arbitrary-tarball path.
	export COREPACK_ENABLE_UNSAFE_CUSTOM_URLS=0

	#    Yarn Berry can still run project code despite disabled build scripts.
	#    Reject it without executing Yarn. The lockfile signature is only decisive
	#    when Yarn is the manager step 5 would actually select, so it is skipped when
	#    packageManager names one or a higher-priority lockfile is present —
	#    otherwise a stale Berry yarn.lock would fail an npm or pnpm project.
	#    YARN_IGNORE_PATH also blocks project-selected Yarn binaries.
	if [ -f "$WORK_DIR/package.json" ]; then
		package_manager="$(node -e '
try {
  const value = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).packageManager
  if (typeof value === "string") process.stdout.write(value)
} catch {}
' "$WORK_DIR/package.json")"
		case "$package_manager" in
		yarn@1.* | "") ;;
		yarn@0.*)
			echo "Yarn 0 is not supported" >&2
			return 1
			;;
		yarn@*)
			echo "Yarn Berry is not supported: install-time scripts cannot be safely disabled (detected via packageManager)" >&2
			return 1
			;;
		esac
		if [ -z "$package_manager" ] && [ ! -f "$WORK_DIR/package-lock.json" ] &&
			[ ! -f "$WORK_DIR/pnpm-lock.yaml" ] &&
			[ -f "$WORK_DIR/yarn.lock" ] && grep -q '^__metadata:' "$WORK_DIR/yarn.lock"; then
			echo "Yarn Berry is not supported: install-time scripts cannot be safely disabled (detected via yarn.lock)" >&2
			return 1
		fi
	fi

	# 2. corepack — install into a writable prefix if the image lacks it (>= 25).
	export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
	mkdir -p ~/.nhost-tools/bin
	if ! command -v corepack >/dev/null 2>&1; then
		echo "  corepack not bundled, installing"
		npm install --ignore-scripts --loglevel=error --no-fund \
			--no-update-notifier --prefix ~/.nhost-tools/corepack corepack@0.34.0
		PATH=~/.nhost-tools/corepack/node_modules/.bin:$PATH
		export PATH
	fi
	corepack enable --install-directory ~/.nhost-tools/bin
	PATH=~/.nhost-tools/bin:$PATH
	export PATH

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

	# 5. require a committed lockfile and pick the frozen, workspace-isolated
	#    install command for it. Select the command here so detection and flag
	#    forwarding cannot change under a third-party wrapper. Corepack still
	#    selects the manager's own version.
	#    Yarn is always Classic (Berry is rejected above), so --frozen-lockfile
	#    is the right flag and yarn has no per-install workspace-isolation flag.
	if [ -f "$WORK_DIR/package-lock.json" ]; then
		set -- npm ci --no-workspaces --ignore-scripts
	elif [ -f "$WORK_DIR/pnpm-lock.yaml" ]; then
		set -- pnpm install --frozen-lockfile --ignore-workspace --ignore-scripts --ignore-pnpmfile
	elif [ -f "$WORK_DIR/yarn.lock" ]; then
		set -- yarn install --frozen-lockfile --ignore-scripts
	else
		echo "no lockfile in $WORK_DIR — commit a package-lock.json, pnpm-lock.yaml, or yarn.lock" >&2
		return 1
	fi

	# 6. frozen, workspace-isolated install.
	(cd "$WORK_DIR" && "$@")
}
