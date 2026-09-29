ROOT_DIR?=$(abspath ../../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


# The check only compiles, lints and tests this program, so it needs no backend.
# Start ../backend-notes yourself when you want to actually run the CLI.
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
check-local:  ## Run the same checks the nix check runs.
	gofmt -l .
	GOFLAGS=-mod=vendor go vet ./...
	GOFLAGS=-mod=vendor golangci-lint run ./...
	GOFLAGS=-mod=vendor go test ./...
