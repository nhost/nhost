# Prose checks for the posts under ../src/pages/blog/. Only this Makefile lives
# here; the landing project's own targets are in ../Makefile.

.PHONY: help
help: ## Show this help.
	@echo
	@awk 'BEGIN { \
		FS = "##"; \
		printf "Usage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z_-]+%?:.*?##/ { printf "  \033[36m%-38s\033[0m %s\n", $$1, $$2 } ' \
		$(MAKEFILE_LIST)


.PHONY: lint-prose
lint-prose: ## Lint all blog posts with Vale, warnings included.
	cd .. && nix develop .\#landing -c pnpm lint:prose


.PHONY: lint-prose-changed
lint-prose-changed: ## Lint blog posts changed against main with Vale.
	cd .. && nix develop .\#landing -c pnpm lint:prose:changed
