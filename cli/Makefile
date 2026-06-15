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
build-npm:  ## Stage the npm packages (main + platform binaries) under ./result/dist
	nix build \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).cli-npm


.PHONY: changelog-bump-refs
changelog-bump-refs:  ## Bump pinned CLI version in get.sh
	@sed -i 's/^VERSION=".*"/VERSION="$(VERSION)"/' get.sh
