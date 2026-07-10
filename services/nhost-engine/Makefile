ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

DOCKER_DEV_ENV_PATH=build/dev/docker


.PHONY: _dev-env-up
_dev-env-up:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-down
_dev-env-down:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes


.PHONY: _dev-env-build
_dev-env-build: build-docker-image
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml build
