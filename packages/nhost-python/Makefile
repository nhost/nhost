ROOT_DIR?=$(abspath ../../)
include $(ROOT_DIR)/build/makefiles/general.makefile

TAG_NAME=nhost-python


.PHONY: _dev-env-up
_dev-env-up:
	bash ./dev-env.sh up


.PHONY: _dev-env-down
_dev-env-down:
	bash ./dev-env.sh down


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


# --- Local convenience targets (CI runs equivalent commands in the Nix check) ---

.PHONY: test-local
test-local:  ## Run the offline unit tests and doctests (no backend).
	uv run pytest tests
	uv run pytest --doctest-modules --import-mode=importlib src

.PHONY: integration-local
integration-local:  ## Run backend doctests and integration tests; requires make dev-env-up.
	NHOST_LOCAL_BACKEND=1 uv run pytest --doctest-modules --import-mode=importlib src
	NHOST_LOCAL_BACKEND=1 uv run pytest tests -m integration

.PHONY: generate
generate:  ## Regenerate the auth/storage clients from the OpenAPI specs.
	./gen.sh
