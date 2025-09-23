ROOT_DIR?=$(abspath ../)
include $(ROOT_DIR)/build/makefiles/general.makefile

TAG_NAME=@nhost/dashboard


.PHONY: dev-env-cli-up
dev-env-cli-up: dev-env-cli-build  ## Starts the CLI using the dev dashboard
	./dev-env-cli.sh up


.PHONY: dev-env-cli-up
dev-env-cli-down: ## Stops the CLI using the dev dashboard
	./dev-env-cli.sh down


.PHONY: dev-env-cli-build
dev-env-cli-build: build-docker-image  ## Build the docker image with the dev dashboard


.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"
