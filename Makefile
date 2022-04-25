DEV_ENV_PATH=build/dev/docker
GITHUB_REF_NAME?="0.0.0-dev"
VERSION=$(shell echo $(GITHUB_REF_NAME) | sed -e 's/^v//g' -e 's/\//_/g')


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
	@echo $(VERSION) > VERSION
	@echo $(VERSION)


.PHONY: tests
tests:  dev-env-up check  ## Spin environment and run nix flake check


.PHONY: check
check:   ## Run nix flake check
	./build/nix.sh flake check --print-build-logs


.PHONY: integration-tests
integration-tests: ## Run go test with integration flags
	@HASURA_AUTH_BEARER=$(shell make dev-jwt) \
	 TEST_S3_ACCESS_KEY=$(shell make dev-s3-access-key) \
	 TEST_S3_SECRET_KEY=$(shell make dev-s3-secret-key) \
	 GIN_MODE=release \
		richgo test -tags=integration $(GOTEST_OPTIONS) ./...   # -run=TestGetFileByID


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	@echo $(VERSION) > VERSION
	./build/nix.sh build --print-build-logs


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	@echo $(VERSION) > VERSION
	./build/nix-docker-image.sh
	docker tag hasura-storage:$(VERSION) hasura-storage:latest


.PHONY: dev-env-up-short
dev-env-up-short:  ## Starts development environment without hasura-storage
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml up -d postgres graphql-engine minio


.PHONY: dev-env-up
dev-env-up: dev-env-down dev-env-build  ## Starts development environment
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: dev-env-down
dev-env-down:  ## Stops development environment
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml down


.PHONY: dev-env-build
dev-env-build: build-docker-image  ## Builds development environment
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml build


.PHONY: dev-jwt
dev-jwt:  ## return a jwt valid for development environment
	@sh ./$(DEV_ENV_PATH)/jwt-gen/get-jwt.sh
	@sleep 2


.PHONY: dev-s3-access-key
dev-s3-access-key:  ## return s3 access key for development environment
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_USER'


.PHONY: dev-s3-secret-key
dev-s3-secret-key:  ## restun s3 secret key for development environment
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_PASSWORD'


.PHONY: migrations-add
migrations-add:  ## add a migration with NAME in the migrations folder
	migrate create -dir ./migrations/postgres -ext sql -seq $(MIGRATION_NAME)
