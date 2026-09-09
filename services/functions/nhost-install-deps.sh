#!/bin/sh
# nhost-install-deps.sh
#
# SHARED, BYTE-IDENTICAL across two repositories — keep both copies in sync:
#   * nhost/be:    services/cd/cmd/installscript/nhost-install-deps.sh
#   * nhost/nhost: services/functions/nhost-install-deps.sh
# Each repo pins sha256(this file) in a test; edit one, update the pinned hash,
# and copy the file to the other repo (the hashes must match).
#
# Installs a project's dependencies without ever running the project's own code.
# The repo being installed is UNTRUSTED: in services/cd it is a customer repo
# being built inside Nhost's infrastructure.
#
# What can run code during an install, and what stops it:
#   * package.json scripts (preinstall/install/postinstall/prepare) -> step 1 env
#   * pnpm .pnpmfile.cjs hooks                                     -> step 1 env
#   * a project-supplied yarn binary (.yarnrc yarn-path)           -> step 1 env
#   * Yarn Berry .yarnrc.yml plugins                               -> step 5 pin
#
# Berry is the awkward one: it loads plugins while starting up, BEFORE it parses
# --ignore-scripts, so no flag or env var can stop it. The only fix is to never
# let Berry run — step 5 hands corepack an explicit Yarn Classic version.
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

NHOST_YARN_CLASSIC_SPEC=1.22.22+sha1.ac34549e6aa8e7ead463a7407e1c7390f61a6610

nhost_install_deps() {
	set -eu

	: "${WORK_DIR:?WORK_DIR must be set}"

	# 1. Turn off every "run the project's code" feature, before anything runs.
	#    Env vars, not config files: we tested that a project's own .npmrc /
	#    pnpm-workspace.yaml / .yarnrc CANNOT override these. Each manager needs
	#    its own — Yarn ignores npm's setting.
	export npm_config_ignore_scripts=true
	export PNPM_CONFIG_IGNORE_SCRIPTS=true
	export PNPM_CONFIG_IGNORE_PNPMFILE=true
	export YARN_IGNORE_SCRIPTS=true
	export YARN_ENABLE_SCRIPTS=false
	export YARN_IGNORE_PATH=1

	export COREPACK_ENV_FILE=0

	#    Set to 1, corepack would fetch a package manager from any URL the
	#    project names. Pin it off so the environment cannot turn that on.
	export COREPACK_ENABLE_UNSAFE_CUSTOM_URLS=0

	# Tell Berry projects why they fail, instead of letting them fail later with
	# a confusing third-party error. This is only about the error message — the
	# thing that actually keeps Berry from running is step 5's pin.
	#
	# Reading the manifest, the parts that are easy to get wrong:
	#   * devEngines version is a RANGE ("^1.22.19"), not a version. Only an
	#     exact version tells us which Yarn this is, so we ignore anything else
	#     and let the checks below decide. A range is safe either way: step 5
	#     pins Classic regardless.
	#   * devEngines.packageManager may be an object OR an array of them.
	#   * A leading BOM is legal to npm, so strip it — don't fail a project npm
	#     would happily install.
	#   * 2>/dev/null hides node's stack trace so our message is the one seen.
	if [ -f "$WORK_DIR/package.json" ]; then
		package_manager="$(node -e '
const raw = require("fs").readFileSync(process.argv[1], "utf8").replace(/^\uFEFF/, "")
const manifest = JSON.parse(raw)
if (typeof manifest.packageManager === "string") {
  process.stdout.write(manifest.packageManager)
} else {
  const declared = manifest.devEngines?.packageManager
  const manager = Array.isArray(declared) ? declared[0] : declared
  if (
    manager &&
    typeof manager.name === "string" &&
    typeof manager.version === "string" &&
    /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(manager.version)
  ) {
    process.stdout.write(`${manager.name}@${manager.version}`)
  }
}
' "$WORK_DIR/package.json" 2>/dev/null)" || {
			echo "could not read $WORK_DIR/package.json; refusing to guess the package manager" >&2
			return 1
		}
		case "$package_manager" in
		yarn@1.* | "") ;;
		yarn@0.*)
			echo "Yarn 0 is not supported" >&2
			return 1
			;;
		yarn@*)
			echo "Yarn Berry is not supported: install-time scripts cannot be safely disabled (detected via packageManager or devEngines.packageManager)" >&2
			return 1
			;;
		esac
		#    A Berry lockfile has a "__metadata:" line. Only check it when yarn is
		#    the manager step 5 would pick (same lockfile order as step 5) —
		#    otherwise a leftover yarn.lock would fail an npm or pnpm project.
		if [ ! -f "$WORK_DIR/package-lock.json" ] &&
			[ ! -f "$WORK_DIR/pnpm-lock.yaml" ] &&
			[ -f "$WORK_DIR/yarn.lock" ] && grep -q '^__metadata:' "$WORK_DIR/yarn.lock"; then
			echo "Yarn Berry is not supported: install-time scripts cannot be safely disabled (detected via yarn.lock)" >&2
			return 1
		fi

		#    If the project ships a .pnpmfile.cjs, pnpm records a checksum of it in
		#    the lockfile and then refuses a frozen install once we disable hooks.
		#    Its error tells the user to re-run with --no-frozen-lockfile, which a
		#    deploy can't do — so say what's actually wrong.
		if [ ! -f "$WORK_DIR/package-lock.json" ] && [ -f "$WORK_DIR/pnpm-lock.yaml" ] &&
			grep -q '^pnpmfileChecksum:' "$WORK_DIR/pnpm-lock.yaml"; then
			echo "pnpm hook files (.pnpmfile.cjs) are not supported: install-time code cannot be safely disabled" >&2
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

	# 3. A dependency wanting to run a build script should be SKIPPED, not treated
	#    as an error. Must be the env var: pnpm 11.0.x ignores this setting in
	#    ~/.config/pnpm/config.yaml, so setting it there fails silently.
	export PNPM_CONFIG_STRICT_DEP_BUILDS=false

	# 4. nothing to install without a project manifest (e.g. a zero-dep function).
	if [ ! -f "$WORK_DIR/package.json" ]; then
		echo "  no package.json in $WORK_DIR, skipping dependency install"
		return 0
	fi

	# 5. Pick the frozen install command from the lockfile.
	#    The yarn line is the security fix. A bare `yarn` lets corepack choose the
	#    version, and it reads packageManager from THIS directory or ANY parent —
	#    so a parent manifest we never looked at could still select Berry. Naming
	#    the version here overrides all of that. The +sha1 is checked on download.
	#    (Classic has no per-install workspace-isolation flag, hence no --ignore.)
	if [ -f "$WORK_DIR/package-lock.json" ]; then
		set -- npm ci --no-workspaces --ignore-scripts
	elif [ -f "$WORK_DIR/pnpm-lock.yaml" ]; then
		set -- pnpm install --frozen-lockfile --ignore-workspace --ignore-scripts --ignore-pnpmfile
	elif [ -f "$WORK_DIR/yarn.lock" ]; then
		set -- corepack "yarn@$NHOST_YARN_CLASSIC_SPEC" install --frozen-lockfile --ignore-scripts
	else
		echo "no lockfile in $WORK_DIR — commit a package-lock.json, pnpm-lock.yaml, or yarn.lock" >&2
		return 1
	fi

	# 6. Run the selected install in the project directory.
	(cd "$WORK_DIR" && "$@")
}
