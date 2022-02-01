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


.PHONY: tests
tests:  dev-env-up check  ## Spin environment and run nix flake check

.PHONY: check
check:   ## Run nix flake check
	nix flake check --print-build-logs

.PHONY: integration-tests
integration-tests: ## Run go test with integration flags
	@HASURA_AUTH_BEARER=$(shell make dev-jwt) \
	 TEST_S3_ACCESS_KEY=$(shell make dev-s3-access-key) \
	 TEST_S3_SECRET_KEY=$(shell make dev-s3-secret-key) \
	 GIN_MODE=release \
		go test -tags=integration $(GOTEST_OPTIONS) ./... #-run=TestListFiles


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	@echo $(VERSION) > VERSION
	nix build --print-build-logs


.PHONY: build-docker-image
build-docker-image:  ## Build docker container
	@echo $(VERSION) > VERSION
ifeq ($(shell uname), Linux)
	nix build .\#dockerImage --print-build-logs
	docker load -q < result
else
	docker run --rm -it \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(PWD):/build \
		-w /build \
		--entrypoint sh \
		nixos/nix:latest \
		-c "nix-env -iA nixpkgs.docker-client nixpkgs.git && nix build .\#dockerImage --extra-experimental-features nix-command --extra-experimental-features flakes && docker load < result"
endif
	docker tag hasura-storage:$(VERSION) hasura-storage:latest


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


.PHONY: dev-s3-access-key
dev-s3-access-key:  ## return s3 access key for development environment
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_USER'


.PHONY: dev-s3-secret-key
dev-s3-secret-key:  ## restun s3 secret key for development environment
	@docker exec -i minio bash -c 'echo $$MINIO_ROOT_PASSWORD'


.PHONY: migrations-add
migrations-add:  ## add a migration with NAME in the migrations folder
	migrate create -dir ./migrations/postgres -ext sql -seq $(MIGRATION_NAME)
