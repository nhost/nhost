ROOT_DIR?=$(abspath ../..)
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


.PHONY: dev-env-up-short
dev-env-up-short:  ## Starts development environment without hasura-storage
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d postgres graphql-engine minio clamd


.PHONY: build-docker-image-clamav-dev
build-docker-image-clamav-dev:  ## Build dev docker container for clamav
	nix build $(docker-build-options) --show-trace \
		.\#packages.$(ARCH)-linux.clamav-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:clamav:$(VERSION)


.PHONY: build-docker-image-clamav
build-docker-image-clamav:  ## Build docker container for clamav
	@echo $(VERSION) > VERSION
	nix build $(docker-build-options) --show-trace \
		.\#packages.aarch64-linux.clamav-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:clamav:$(VERSION)-aarch64
	nix build $(docker-build-options) --show-trace \
		.\#packages.x86_64-linux.clamav-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:clamav:$(VERSION)-x86_64
	docker push nhost/clamav:$(VERSION)-aarch64
	docker push nhost/clamav:$(VERSION)-x86_64
	docker manifest create \
	  nhost/clamav:$(VERSION) \
	    --amend nhost/clamav:$(VERSION)-aarch64 \
	    --amend nhost/clamav:$(VERSION)-x86_64
	docker manifest push nhost/clamav:$(VERSION)
