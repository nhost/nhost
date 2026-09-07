ROOT_DIR?=$(abspath ../../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


# The check only lints, type-checks and tests this service, so it needs no
# backend. Start ../backend yourself when you want to actually run it.
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
backend-up:  ## Start the demos backend (it owns the webhook_events table).
	cd $(ROOT_DIR)/examples/demos/backend && ./env-up.sh

.PHONY: backend-down
backend-down:  ## Stop the demos backend.
	cd $(ROOT_DIR)/examples/demos/backend && nhost down --volumes

.PHONY: docker-build
docker-build:  ## Build the service image (from the repo root, as the Dockerfile expects).
	cd $(ROOT_DIR) && docker build -f examples/demos/webhook-receiver/Dockerfile -t webhook-receiver:dev .

.PHONY: check-local
check-local:  ## Run the same checks the nix check runs.
	ruff check app.py test_app.py
	ruff format --check app.py test_app.py
	mypy app.py
	pytest -rs test_app.py
