ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' flake.nix)
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

DEV_ENV_PATH=build/dev
DOCKER_DEV_ENV_PATH=$(DEV_ENV_PATH)/docker
GITHUB_REF_NAME?="0.0.0-dev"


.PHONY: help
help: ## Show this help.
	@IFS=$$'\n' ; \
	lines=(`fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//'`); \
	for line in $${lines[@]}; do \
		IFS=$$'#' ; \
		split=($$line) ; \
		command=`echo $${split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		info=`echo $${split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		printf "%-38s %s\n" $$command $$info ; \
	done


.PHONY: get-version
get-version:  ## Return version
	@sed -i "s/version\s*=\s*\"[^\"]*\"/version = \"${VERSION}\"/" flake.nix
	@sed -i '/^\s*created = "1970-.*";/s//created = "${shell date --utc '+%Y-%m-%dT%H:%M:%SZ'}";/' flake.nix
	@echo $(VERSION)


.PHONY: check
check:   ## Run nix flake check
	./build/nix.sh flake check --print-build-logs


.PHONY: check-dry-run
check-dry-run:  ## Run nix flake check
	@nix path-info \
		--derivation \
		.\#checks.$(ARCH)-$(OS).go-checks


.PHONY: integration-tests
integration-tests: ## Run go test with integration flags
	@HASURA_AUTH_BEARER=$(shell make -s dev-jwt) \
	 TEST_S3_ACCESS_KEY=$(shell make -s dev-s3-access-key) \
	 TEST_S3_SECRET_KEY=$(shell make -s dev-s3-secret-key) \
	 GIN_MODE=release \
		richgo test -tags=integration $(GOTEST_OPTIONS) ./... # -run=UploadFile/with_virus


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	./build/nix.sh build --print-build-logs


.PHONY: build-dry-run
build-dry-run:  ## Run nix flake check
	@nix path-info \
		--derivation \
		.\#packages.$(ARCH)-$(OS).default


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	./build/nix-docker-image.sh
	skopeo copy --insecure-policy dir:./result docker-daemon:hasura-storage:$(VERSION)
	docker tag hasura-storage:$(VERSION) nhost/hasura-storage:$(VERSION)


.PHONY: build-docker-image-clamav-dev
build-docker-image-clamav-dev:  ## Build dev docker container for clamav
	@echo $(VERSION) > VERSION
	./build/nix-docker-image.sh clamav-docker-image
	docker tag clamav:$(VERSION) clamav:dev

.PHONY: build-docker-image-clamav
build-docker-image-clamav:  ## Build docker container for clamav
	@echo $(VERSION) > VERSION
	./build/nix-docker-image.sh clamav-docker-image aarch64-linux
	docker tag clamav:$(VERSION) nhost/clamav:$(VERSION)-aarch64
	./build/nix-docker-image.sh clamav-docker-image x86_64-linux
	docker tag clamav:$(VERSION) nhost/clamav:$(VERSION)-x86_64
	docker push nhost/clamav:$(VERSION)-aarch64
	docker push nhost/clamav:$(VERSION)-x86_64
	docker manifest create \
	  nhost/clamav:$(VERSION) \
	    --amend nhost/clamav:$(VERSION)-aarch64 \
	    --amend nhost/clamav:$(VERSION)-x86_64
	docker manifest push nhost/clamav:$(VERSION)


.PHONY: dev-env-up-short
dev-env-up-short:  ## Starts development environment without hasura-storage
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d postgres graphql-engine minio clamd


.PHONY: dev-env-up-hasura
dev-env-up-hasura: build-docker-image  ## Starts development environment but only hasura-storage
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d storage

.PHONY: dev-env-up
dev-env-up: dev-env-build  ## Starts development environment
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: dev-env-down
dev-env-down:  ## Stops development environment
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml down


.PHONY: dev-env-build
dev-env-build: build-docker-image  ## Builds development environment
	docker compose -f ${DOCKER_DEV_ENV_PATH}/docker-compose.yaml build


.PHONY: dev-jwt
dev-jwt:  ## return a jwt valid for development environment
	@sh ./$(DEV_ENV_PATH)/jwt-gen/get-jwt.sh
	@sleep 2


.PHONY: dev-s3-access-key
dev-s3-access-key:  ## return s3 access key for development environment
	@docker exec -i hasura-storage-minio bash -c 'echo $$MINIO_ROOT_USER'


.PHONY: dev-s3-secret-key
dev-s3-secret-key:  ## restun s3 secret key for development environment
	@docker exec -i hasura-storage-minio bash -c 'echo $$MINIO_ROOT_PASSWORD'


.PHONY: migrations-add
migrations-add:  ## add a migration with NAME in the migrations folder
	migrate create -dir ./migrations/postgres -ext sql -seq $(MIGRATION_NAME)
