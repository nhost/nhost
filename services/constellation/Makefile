ROOT_DIR?=$(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

DOCKER_DEV_ENV_PATH=build/dev/docker


.PHONY: _dev-env-up
_dev-env-up: dev-env-integration-up run-up
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-down
_dev-env-down: dev-env-integration-down run-down
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes


.PHONY: dev-env-up-short
dev-env-up-short: _dev-env-up dev-env-integration-up
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-build
_dev-env-build: build-docker-image


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


.PHONY: run-up
run-up:  ## Run constellation in dev mode inside a container connected to the integration environment
	docker run --rm -d \
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


.PHONY: run-down
run-down:  ## Stop the constellation container
	docker rm -f constellation || true
