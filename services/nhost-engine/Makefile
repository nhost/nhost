ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

# The engine's checks are pure unit tests with no backing services, so the
# check pipeline's dev-env hooks are no-ops, mirroring the CLI. The
# illustrative multi-service stack under build/dev/docker/docker-compose.yaml
# is brought up manually (see that file's header), not via `make dev-env-up`.

.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"
