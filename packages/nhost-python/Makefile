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


# --- Local convenience targets (not used by CI; the nix check runs these) ---

.PHONY: test test-local
test test-local:  ## Run the offline unit suite via uv (no backend).
	uv run pytest

.PHONY: test-doctests doctests-local
test-doctests doctests-local:  ## Run docstring examples via uv; backend ones skip.
	uv run pytest --doctest-modules --import-mode=importlib src tests

.PHONY: test-integration
test-integration:  ## Run backend doctests, or skip when the local backend is unavailable.
	@if uv run python -c 'import httpx; response = httpx.post("https://local.graphql.local.nhost.run/v1", json={"query": "query { __typename }"}, timeout=2); response.raise_for_status()' >/dev/null 2>&1; then \
		NHOST_LOCAL_BACKEND=1 uv run pytest --doctest-modules --import-mode=importlib src tests; \
	else \
		echo "SKIP: local Nhost backend is unavailable; run make dev-env-up first."; \
	fi

.PHONY: generate
generate:  ## Regenerate the auth/storage clients from the OpenAPI specs.
	./gen.sh
