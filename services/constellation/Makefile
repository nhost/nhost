ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

DOCKER_DEV_ENV_PATH=build/dev/docker


# parity-env-up is a prerequisite (runs after dev-env-integration-up so the
# integration Postgres exists, and after the image is built by _dev-env-build)
# so `make dev-env-up` — which CI runs before `make check` — brings up the
# parity Constellation on :8001. Without it, integration/metadata_parity_test.go
# skips instead of running.
.PHONY: _dev-env-up
_dev-env-up: dev-env-integration-up run-up parity-env-up
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


# parity-env-down first, while the integration Postgres is still up, so the cstl
# database drop succeeds.
.PHONY: _dev-env-down
_dev-env-down: parity-env-down dev-env-integration-down run-down
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down --volumes


.PHONY: dev-env-up-short
dev-env-up-short: dev-env-integration-up
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: _dev-env-build
_dev-env-build: build-docker-image


.PHONY: dev-env-integration-up
dev-env-integration-up:
	cd integration && [ -f .secrets ] || cp .secrets.example .secrets
	cd integration && nhost up --apply-seeds


.PHONY: dev-env-integration-down
dev-env-integration-down:
	cd integration && nhost down --volumes


PACKAGE ?= ./...
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
	  -e CONSTELLATION_DEBUG=true \
	  -e CONSTELLATION_DEV_MODE=true \
	  -e CONSTELLATION_LOG_FORMAT_TEXT=true \
	  -e CONSTELLATION_ENABLE_PLAYGROUND=true \
	  -e CONSTELLATION_METADATA_PATH=/metadata/ \
	  -e NHOST_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e NHOST_FUNCTIONS_URL=http://integration-functions-1:3000 \
	  -e NHOST_WEBHOOK_SECRET=nhost-webhook-secret \
	  -e CONSTELLATION_ADMIN_SECRET=nhost-admin-secret \
	  -e CONSTELLATION_JWT_SECRET='{"key":"0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db","type":"HS256"}' \
	  constellation:0.0.0-dev \
	    serve


.PHONY: run-up-dbsource
run-up-dbsource:  ## Run constellation against hdb_catalog.hdb_metadata in the integration Postgres (mutable metadata API)
	docker run --rm -d \
	  --network integration_default \
	  -p 8000:8000 \
	  --name constellation \
	  -e CONSTELLATION_DEBUG=true \
	  -e CONSTELLATION_DEV_MODE=true \
	  -e CONSTELLATION_LOG_FORMAT_TEXT=true \
	  -e CONSTELLATION_ENABLE_PLAYGROUND=true \
	  -e CONSTELLATION_METADATA_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e NHOST_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e NHOST_FUNCTIONS_URL=http://integration-functions-1:3000 \
	  -e NHOST_WEBHOOK_SECRET=nhost-webhook-secret \
	  -e CONSTELLATION_ADMIN_SECRET=nhost-admin-secret \
	  -e CONSTELLATION_JWT_SECRET='{"key":"0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db","type":"HS256"}' \
	  constellation:0.0.0-dev \
	    serve


.PHONY: parity-env-up
parity-env-up:  ## Set up the metadata-parity env: isolated 'cstl' metadata DB + a second constellation on :8001 (needs dev-env-integration-up)
	bash integration/scripts/setup_parity_env.sh
	docker run --rm -d \
	  --network integration_default \
	  -p 8001:8000 \
	  --name constellation-parity \
	  -e CONSTELLATION_DEBUG=true \
	  -e CONSTELLATION_DEV_MODE=true \
	  -e CONSTELLATION_LOG_FORMAT_TEXT=true \
	  -e CONSTELLATION_ENABLE_PLAYGROUND=true \
	  -e CONSTELLATION_METADATA_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/cstl \
	  -e NHOST_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:postgres@integration-postgres-1:5432/local \
	  -e NHOST_FUNCTIONS_URL=http://integration-functions-1:3000 \
	  -e NHOST_WEBHOOK_SECRET=nhost-webhook-secret \
	  -e CONSTELLATION_ADMIN_SECRET=nhost-admin-secret \
	  -e CONSTELLATION_HASURA_UPSTREAM_URL= \
	  -e CONSTELLATION_ASYNC_ACTION_WORKER_ENABLED=true \
	  -e CONSTELLATION_ASYNC_ACTION_WORKER_EXCLUSIVE_OWNER=true \
	  -e CONSTELLATION_ACTION_LOG_CREATE_IF_NOT_EXISTS=true \
	  -e CONSTELLATION_JWT_SECRET='{"key":"0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db","type":"HS256"}' \
	  constellation:0.0.0-dev \
	    serve


.PHONY: parity-env-down
parity-env-down:  ## Tear down the metadata-parity env (constellation-parity container + cstl DB)
	docker rm -f constellation-parity || true
	docker exec integration-postgres-1 psql -U postgres \
	  -c "DROP DATABASE IF EXISTS cstl WITH (FORCE);" || true


.PHONY: run-down
run-down:  ## Stop the constellation container
	docker rm -f constellation || true
