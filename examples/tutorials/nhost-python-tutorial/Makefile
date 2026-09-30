ROOT_DIR?=$(abspath ../../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


# The check only lints, type-checks and tests this program, so it needs no
# backend. Start ../backend-notes yourself when you want to actually run the CLI.
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

.PHONY: lock
lock:  ## Recompile requirements.txt from requirements.in (needs network).
	uv pip compile requirements.in --python-version 3.11 -o requirements.txt

.PHONY: check-local
check-local:  ## Run the same checks the nix check runs.
	ruff check main.py test_main.py
	ruff format --check main.py test_main.py
	mypy main.py
	pytest -rs test_main.py

PAGES=$(ROOT_DIR)/docs/src/content/docs/getting-started/tutorials/python

.PHONY: docs-snippets
docs-snippets:  ## Lint and type-check the tutorial pages' programs and check their ranges.
	python3 docs_snippets.py $(PAGES) ranges
	rm -rf docs_parts
	python3 docs_snippets.py $(PAGES) extract docs_parts
	ruff check docs_parts && ruff format --check docs_parts && mypy docs_parts/*.py; \
		status=$$?; rm -rf docs_parts; exit $$status

.PHONY: docs-ranges
docs-ranges:  ## Recompute the tutorial pages' collapse/highlight ranges.
	python3 docs_snippets.py $(PAGES) ranges --write
