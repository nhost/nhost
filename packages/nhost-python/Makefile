ROOT_DIR?=$(abspath ../../)
include $(ROOT_DIR)/build/makefiles/general.makefile

TAG_NAME=nhost-python


.PHONY: _dev-env-up
_dev-env-up:
	./dev-env.sh up


.PHONY: _dev-env-down
_dev-env-down:
	./dev-env.sh down


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


# --- Local convenience targets (not used by CI; the nix check runs these) ---

.PHONY: test-local
test-local:  ## Run the offline unit suite via uv (no backend).
	uv run pytest

.PHONY: doctests-local
doctests-local:  ## Run docstring examples via uv; backend ones skip unless NHOST_LOCAL_BACKEND=1.
	uv run pytest --doctest-modules --import-mode=importlib src tests

.PHONY: generate
generate:  ## Regenerate the auth/storage clients from the OpenAPI specs.
	./gen.sh
