ROOT_DIR?=$(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

NODE_VERSION?=22
DOCKER_DEV_ENV_PATH=build/dev/docker

# Capture base version (without Node prefix) for changelog-bump-refs
BUMP_VERSION:=$(VERSION)

# Prepend Node version to VERSION if not already prefixed
ifneq ($(NODE_VERSION)-,$(firstword $(subst -, ,$(VERSION)))-)
VERSION:=$(NODE_VERSION)-$(VERSION)
endif


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	nix build $(docker-build-options) --show-trace \
		.\#packages.$(ARCH)-linux.$(NAME)-node$(NODE_VERSION)-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME):$(VERSION)


.PHONY: _dev-env-build
_dev-env-build:
	$(MAKE) build-docker-image NODE_VERSION=22
	$(MAKE) build-docker-image NODE_VERSION=24


.PHONY: _dev-env-up
_dev-env-up:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-down
_dev-env-down:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes


.PHONY: changelog-bump-refs
changelog-bump-refs:  ## Bump functions version ref in CLI source and docs
	@sed -i 's|defaultFunctionsVersion = "[^"]*"|defaultFunctionsVersion = "$(BUMP_VERSION)"|' $(ROOT_DIR)/cli/cmd/dev/up.go
	@sed -i 's|\(--functions-version\*\*.*(default: \)"[^"]*"|\1"$(BUMP_VERSION)"|' $(ROOT_DIR)/docs/src/content/docs/reference/cli/commands.mdx
