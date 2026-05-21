DOCKER_DEV_ENV_PATH=build/dev/docker

NAME:=constellation

ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' flake.nix | head -n 1)
endif

ifeq ($(shell uname -m),x86_64)
  ARCH?=x86_64
else ifeq ($(shell uname -m),arm64)
  ARCH?=aarch64
else ifeq ($(shell uname -m),aarch64)
   ARCH?=aarch64
else
   ARCH?=FIXME-$(shell uname -m)
endif

ifeq ($(shell uname -o),Darwin)
  OS?=darwin
else
  OS?=linux
endif


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	nix build \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).$(NAME)


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	nix build $(docker-build-options) --show-trace \
		.\#packages.$(ARCH)-linux.$(NAME)-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME):$(VERSION)


.PHONY: dev-env-up
dev-env-up:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: dev-env-down
dev-env-down:
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes


.PHONY: dev-env-integration-up
dev-env-integration-up:
	cd integration && nhost up --apply-seeds


.PHONY: dev-env-integration-down
dev-env-integration-down:
	cd integration && nhost down --volumes

PACKAGE?=./...

.PHONY: coverage
coverage:  ## Run test coverage for PACKAGE (default: ./...). Usage: make coverage PACKAGE=./connector/memconnector
	go test $(PACKAGE) -coverprofile=coverage.out
	go tool cover -func=coverage.out

.PHONY: coverage-html
coverage-html: coverage  ## Same as coverage but also opens an HTML report
	go tool cover -html=coverage.out

.PHONY: run
run:
	docker run --rm \
	  --network integration_default \
	  -v $(shell pwd)/integration/nhost/metadata:/metadata \
	  -p 8000:8000 \
	  --name constellation \
	  -e DEBUG=true \
	  -e NHOST_DEV_MODE=true \
	  -e LOG_FORMAT_TEXT=true \
	  -e ENABLE_PLAYGROUND=true \
	  -e METADATA_PATH=/metadata/ \
	  -e NHOST_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e NHOST_FUNCTIONS_URL=http://integration-functions-1:3000 \
	  -e NHOST_WEBHOOK_SECRET=nhost-webhook-secret \
	  -e NHOST_ADMIN_SECRET=nhost-admin-secret \
	  -e NHOST_JWT_SECRET='{"key":"0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db","type":"HS256"}' \
	  constellation:0.0.0-dev \
	    serve
