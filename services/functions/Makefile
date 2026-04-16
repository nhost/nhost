ROOT_DIR?=$(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

NODE_VERSION?=22
DOCKER_DEV_ENV_PATH=build/dev/docker


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	nix build $(docker-build-options) --show-trace \
		.\#packages.$(ARCH)-linux.$(NAME)-node$(NODE_VERSION)-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME)-node$(NODE_VERSION):$(VERSION)


.PHONY: _dev-env-build
_dev-env-build:
	$(MAKE) build-docker-image NODE_VERSION=22
	$(MAKE) build-docker-image NODE_VERSION=20


.PHONY: _dev-env-up
_dev-env-up:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-down
_dev-env-down:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes
