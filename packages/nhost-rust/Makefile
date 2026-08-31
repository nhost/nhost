ROOT_DIR?=$(abspath ../../)
include $(ROOT_DIR)/build/makefiles/general.makefile

TAG_NAME=nhost-rust


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
test-local:  ## Run the offline unit tests (no backend).
	cargo test --test unit

.PHONY: integration-local
integration-local:  ## Run integration tests; requires a local backend.
	NHOST_LOCAL_BACKEND=1 cargo test --test integration

.PHONY: generate
generate:  ## Regenerate the auth/storage clients from the OpenAPI specs.
	./gen.sh
