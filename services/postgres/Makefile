ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

POSTGRES_VERSION ?= 18
POSTGRES_VERSION := $(or $(POSTGRES_VERSION),18)

# Resolve full PostgreSQL version (e.g., 18 -> 18.3) from the nix overlay.
POSTGRES_FULL_VERSION := $(shell grep -A4 'postgresql_$(POSTGRES_VERSION) =' $(ROOT_DIR)/nixops/overlays/postgres.nix | grep -oP 'version = "\K[^"]+')

# Prepend full PG version to VERSION if not already present
VERSION := $(shell printf '%s' '$(VERSION)' | grep -Fq '$(POSTGRES_VERSION)' && printf '%s' '$(VERSION)' || printf '%s-%s' '$(POSTGRES_FULL_VERSION)' '$(VERSION)')


NIX_PACKAGE_ATTR=postgres-pg$(POSTGRES_VERSION)
NIX_DOCKER_ATTR=postgres-pg$(POSTGRES_VERSION)-as-dir
DOCKER_IMAGE_NAME=nhost/postgres


.PHONY: _check-pre
_check-pre: check-pitr-container check-pitr-restart check-graceful-shutdown check-extension-upgrades


.PHONY: check-docker
check-docker:  ## Run checks in the development environment
	# The pg_durable HTTP worker must be able to verify HTTPS certificates.
	docker exec -it postgres-tests sh -c 'test -s "$${SSL_CERT_FILE:?}"'
	docker exec -it postgres-tests psql -U postgres \
		-f /tests/plugins.sql --no-psqlrc -1 -d local -v "ON_ERROR_STOP=1"
	# Do not add -1: the readiness procedure commits between worker-state polls.
	docker exec -it postgres-tests psql -U postgres \
		-f /tests/pg_durable_http.sql --no-psqlrc -d local -v "ON_ERROR_STOP=1"


.PHONY: check-pitr-container
check-pitr-container:  ## Verify PITR preflight uses the image's writable temp directory
	./tests/pitr-restore-container.sh


.PHONY: check-pitr-restart
check-pitr-restart:  ## Verify a promoted PITR target survives normal restart
	./tests/pitr-restart-container.sh


.PHONY: check-graceful-shutdown
check-graceful-shutdown:  ## Verify PostgreSQL shuts down cleanly
	./tests/test-graceful-shutdown.sh


.PHONY: check-extension-upgrades
check-extension-upgrades:  ## Verify extensions upgrade from the previous image
	./tests/test-extension-upgrades.sh


.PHONY: _dev-env-build
_dev-env-build: build-docker-image


.PHONY: _dev-env-up
_dev-env-up:
	docker rm -fv postgres-tests || true
	docker run -d --name postgres-tests \
		-v $(shell pwd)/tests:/tests:ro -p 5432:5432 \
		-e POSTGRES_DEV_INSECURE=1 \
		-e SHARED_PRELOAD_LIBRARIES=pg_stat_statements,pg_cron,timescaledb,pg_squeeze,pg_search,pg_durable,pg_ivm \
		--health-cmd="pg_isready -U postgres -d postgres -q" \
		nhost/postgres:$(VERSION)


.PHONY: _dev-env-down
_dev-env-down:
	docker rm -fv postgres-tests || true


.PHONY: dev-env-connect
dev-env-connect:  ## Connect to development environment
	docker exec -it postgres-tests psql -U postgres


.PHONY: get-plugin-versions
get-plugin-versions:  ## Get plugin versions and save to plugins.md
	@echo "| Name | Version | Description |" > plugins.md
	@echo "| ---- | ------- | ----------- |" >> plugins.md
	@docker exec postgres-tests psql -U postgres --no-psqlrc -t -A -F '|' \
		-c "SELECT name, default_version, comment FROM pg_available_extensions ORDER BY name ASC;" \
		| sed 's/^/| /; s/$$/|/' >> plugins.md
	@echo "Saved to plugins.md"
