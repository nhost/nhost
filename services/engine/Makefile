ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

# The engine's checks are pure unit tests with no backing services, so the
# check pipeline's dev-env hooks are no-ops, mirroring the CLI.

.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


.PHONY: changelog-bump-refs
changelog-bump-refs:  ## Bump engine version refs in CLI source and schemas
	@sed -i 's|defaultEngineVersion = "[^"]*"|defaultEngineVersion = "$(VERSION)"|' $(ROOT_DIR)/cli/dockercompose/engine.go
	@sed -i '/^#Nhost: {/,/^}/ s#version: string | \*"[^"]*"#version: string | *"$(VERSION)"#' $(ROOT_DIR)/vendor/github.com/nhost/be/services/mimir/schema/schema.cue
	@sed -i '/^#Nhost: {/,/^}/ s#version: string | \*"[^"]*"#version: string | *"$(VERSION)"#' $(ROOT_DIR)/cli/mcp/resources/nhost_toml_schema.cue
