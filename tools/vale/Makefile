ROOT_DIR?=$(abspath ../../)
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


.PHONY: test
test: ## Run the Vale rule fixtures.
	nix develop .\#$(NAME) -c bash $(ROOT_DIR)/.vale/test.sh


.PHONY: lint
lint: ## Lint repository Markdown with Vale, warnings included.
	nix develop .\#$(NAME) -c bash $(ROOT_DIR)/.vale/lint_markdown.sh


.PHONY: spellcheck
spellcheck: ## Check every tracked Markdown file for misspellings.
	nix develop .\#$(NAME) -c bash $(ROOT_DIR)/.vale/spellcheck.sh
