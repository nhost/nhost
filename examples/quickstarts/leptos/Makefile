ROOT_DIR?=$(abspath ../../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


# The check only compiles and lints this crate, so it needs no backend. Start
# ../backend yourself when you want to actually run the app.
.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


# --- Local convenience targets (not used by CI; the nix check runs these) ---

.PHONY: backend-up
backend-up:  ## Start the quickstarts backend this example queries.
	cd $(ROOT_DIR)/examples/quickstarts/backend && ./env-up.sh

.PHONY: backend-down
backend-down:  ## Stop the quickstarts backend.
	cd $(ROOT_DIR)/examples/quickstarts/backend && nhost down --volumes

.PHONY: serve
serve:  ## Build and serve the app with Trunk.
	trunk serve --open

.PHONY: check-local
check-local:  ## Run the same fmt + clippy the nix check runs.
	cargo fmt --check
	cargo clippy --locked --all-targets --target wasm32-unknown-unknown -- -D warnings
