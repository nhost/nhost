ROOT_DIR?=$(abspath ../)
NIX_CHECK_EXTRA_ARGS=--impure
include $(ROOT_DIR)/build/makefiles/general.makefile


.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


.PHONY: build-multiplatform
build-multiplatform:  ## Build cli for all supported platforms
	nix build \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).cli-multiplatform


.PHONY: build-npm
build-npm:  ## Stage the npm packages (main + platform binaries) under ./build/npm/dist
	mkdir -p build/npm
	nix build \
		--print-build-logs \
		--out-link build/npm/dist \
		.\#packages.$(ARCH)-$(OS).cli-npm


.PHONY: validate-npm
validate-npm:  ## Validate staged npm packages under ./build/npm/dist
	nix develop .\#pnpm -c env VERSION="$(VERSION)" NPM_DIST_DIR="build/npm/dist" \
		node build/npm/scripts/validate-staged-packages.mjs


.PHONY: publish-npm
publish-npm:  ## Publish staged npm packages from ./build/npm/dist
	nix develop .\#pnpm -c env VERSION="$(VERSION)" NPM_DIST_DIR="build/npm/dist" NPM_TAG="$(NPM_TAG)" \
		node build/npm/scripts/publish-staged-packages.mjs


.PHONY: changelog-bump-refs
changelog-bump-refs:  ## Bump pinned CLI version in get.sh
	@sed -i 's/^VERSION=".*"/VERSION="$(VERSION)"/' get.sh
