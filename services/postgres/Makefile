ROOT_DIR?=$(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

ifndef POSTGRES_VERSION
POSTGRES_VERSION=18
endif

# Prepend PG version to VERSION if not already present
ifeq (,$(findstring $(POSTGRES_VERSION),$(VERSION)))
VERSION:=$(POSTGRES_VERSION)-$(VERSION)
endif


# Override: postgres packages use version-specific nix attr names
.PHONY: build
build:  ## Build postgres binary
	nix build --print-build-logs \
		.\#packages.$(ARCH)-$(OS).postgres-pg$(POSTGRES_VERSION)


.PHONY: build-dry-run
build-dry-run:  ## Returns the derivation of the build
	@nix build --dry-run --json \
		.\#packages.$(ARCH)-$(OS).postgres-pg$(POSTGRES_VERSION) | jq -r '.[].outputs.out'


.PHONY: build-docker-image
build-docker-image:  ## Build and load postgres docker image
	nix build $(docker-build-options) --print-build-logs \
		.\#packages.$(ARCH)-linux.postgres-pg$(POSTGRES_VERSION)-as-dir
	skopeo copy --insecure-policy dir:./result docker-daemon:nhost/postgres:$(VERSION)
	@echo Image Loaded: docker-daemon:nhost/postgres:$(VERSION)


# Override: check-dry-run uses postgres check name
.PHONY: check-dry-run
check-dry-run:  ## Returns the derivation of the check
	@nix build --dry-run --json .\#checks.$(ARCH)-$(OS).postgres | jq -r '.[].outputs.out'


.PHONY: check-docker
check-docker:  ## Run check in the development environment
	docker exec -it postgres-tests psql -U postgres \
		-f /tests/plugins.sql --no-psqlrc -1 -d local -v "ON_ERROR_STOP=1"


.PHONY: _dev-env-build
_dev-env-build: build-docker-image


.PHONY: _dev-env-up
_dev-env-up:
	docker rm -f postgres-tests || true
	docker run -d --name postgres-tests \
		-v $(shell pwd)/tests:/tests:ro --rm -p 5432:5432 \
		-e POSTGRES_DEV_INSECURE=1 \
		--health-cmd="pg_isready -U postgres -d postgres -q" \
		nhost/postgres:$(VERSION)


.PHONY: _dev-env-down
_dev-env-down:
	docker rm -f postgres-tests || true


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
