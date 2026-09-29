ROOT_DIR?=$(abspath ../../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


# The check only compiles and lints this crate, so it needs no backend. Start
# ../backend-notes yourself when you want to actually run the CLI.
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
backend-up:  ## Start the notes backend this example runs against.
	cd $(ROOT_DIR)/examples/tutorials/backend-notes && ./env-up.sh

.PHONY: backend-down
backend-down:  ## Stop the notes backend.
	cd $(ROOT_DIR)/examples/tutorials/backend-notes && nhost down --volumes

.PHONY: check-local
check-local:  ## Run the same fmt + clippy the nix check runs.
	cargo fmt --check
	cargo clippy --locked --all-targets -- -D warnings

.PHONY: docs-snippets
docs-snippets:  ## Compile the tutorial pages' programs and check their ranges.
	python3 docs_snippets.py $(ROOT_DIR)/docs/src/content/docs/getting-started/tutorials/rust ranges
	rm -rf src/bin
	python3 docs_snippets.py $(ROOT_DIR)/docs/src/content/docs/getting-started/tutorials/rust extract src/bin
	cargo clippy --locked --bins -- -D warnings; status=$$?; rm -rf src/bin; exit $$status

.PHONY: docs-ranges
docs-ranges:  ## Recompute the tutorial pages' collapse/highlight ranges.
	python3 docs_snippets.py $(ROOT_DIR)/docs/src/content/docs/getting-started/tutorials/rust ranges --write
