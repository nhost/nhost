ROOT_DIR?=$(abspath ../)
include $(ROOT_DIR)/build/makefiles/general.makefile


.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"


.PHONY: lint-prose
lint-prose: ## Lint all docs pages with Vale, warnings included.
	nix develop .\#$(NAME) -c pnpm lint:prose


.PHONY: lint-prose-changed
lint-prose-changed: ## Lint docs pages changed against main with Vale.
	nix develop .\#$(NAME) -c pnpm lint:prose:changed
