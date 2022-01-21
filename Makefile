MODULE=github.com/nhost/hasura-storage
GITSHA=$(shell git rev-parse HEAD)
BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
DATE=$(shell date -u +%Y-%m-%dT%TZ)
BUILD_USER?=$(shell whoami)
VERSION=$(shell cat VERSION)

GOLANGCI_LINT_VER="v1.43.0"
GOTEST_OPTIONS?=-v

LDFLAGS="\
		-X $(MODULE)/controller.buildVersion=${VERSION} \
		-X $(MODULE)/controller.buildCommit=${GITSHA} \
		-X $(MODULE)/controller.buildBranch=${BRANCH} \
		-X $(MODULE)/controller.buildDate=${DATE} \
		-X $(MODULE)/controller.buildUser=${BUILD_USER} \
		"

DEV_ENV_PATH=build/dev/docker


MIGRATION_DIR=$(PWD)/migrations/
MIGRATION_CMD=docker run --rm -v $(MIGRATION_DIR):/migrations migrate/migrate -path=/migrations/

.PHONY: info
info: ## Echo common env vars
	@echo BRANCH:     $(BRANCH)
	@echo DATE:       $(DATE)
	@echo VERSION:    $(VERSION)
	@echo BUILD_USER: $(BUILD_USER)


.PHONY: help
help: ## Show this help.
	@IFS=$$'\n' ; \
	lines=(`fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//'`); \
	for line in $${lines[@]}; do \
		IFS=$$'#' ; \
		split=($$line) ; \
		command=`echo $${split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		info=`echo $${split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		printf "%-30s %s\n" $$command $$info ; \
	done


.PHONY: tests
tests: dev-env-up integration-tests dev-env-down ## Run go test

.PHONY: integration-tests
integration-tests: ## Run go test with integration flags
	@HASURA_AUTH_BEARER=$(shell make dev-jwt) \
	 TEST_S3_ACCESS_KEY=$(shell make dev-s3-access-key) \
	 TEST_S3_SECRET_KEY=$(shell make dev-s3-secret-key) \
	 GIN_MODE=release \
		go test -tags=integration $(GOTEST_OPTIONS) ./... #-run=TestListFiles


.PHONY: install-linter
install-linter: ## Install golangci-linet
	curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s $(GOLANGCI_LINT_VER)


.PHONY: lint
lint: ## Run Go linters in a Docker container
	bin/golangci-lint \
		run \
		--timeout 300s


.PHONY: build
build: ## Build application
	 go build \
		 -ldflags ${LDFLAGS} \
		 -o ./bin/hasura-storage \
		 ./cmd/*.go

.PHONY: dev-env-up
dev-env-up: dev-env-down dev-env-build  ## Starts development environment
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml up -d


.PHONY: dev-env-down
dev-env-down:  ## Stops development environment
	docker-compose -f ${DEV_ENV_PATH}/docker-compose.yaml down

.PHONY: dev-env-build
dev-env-build:  ## Builds development environment
	docker-compose  -f ${DEV_ENV_PATH}/docker-compose.yaml build --build-arg BUILD_USER=$(BUILD_USER)

.PHONY: dev-jwt
dev-jwt:
	@sh ./build/dev/docker/jwt-gen/get-jwt.sh

.PHONY: dev-s3-access-key
dev-s3-access-key:
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_USER'

.PHONY: dev-s3-secret-key
dev-s3-secret-key:
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_PASSWORD'

.PHONY: migrations-add
migrations-add:
	$(MIGRATION_CMD) create -dir /migrations -ext sql -seq $(MIGRATION_NAME)
