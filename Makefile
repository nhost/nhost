PORT=4000
TAG=local
IMAGE=nhost/hasura-auth:$(TAG)

.SILENT:

.PHONY: help
help: ## Show this help.
	@IFS=$$'\n' ; \
	lines=(`fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//'`); \
	for line in $${lines[@]}; do \
		IFS=$$'#' ; \
		split=($$line) ; \
		command=`echo $${split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		info=`echo $${split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
		printf "%-38s %s\n" $${command%:*} $$info ; \
	done


.PHONY: get-version
get-version:  ## Return version.
	jq -r ".version" package.json


.PHONY: dev
dev: check-port install compose-up  ## Start development environment.
	bash -c "trap 'make compose-down' EXIT; pnpm dev"


.PHONY: test
test: check-port install compose-up ## Run end-to-end tests.
	pnpm test

.PHONY: check-port
check-port:
	[[ -z $$(lsof -t -i tcp:$(PORT)) ]] || (echo "The port $(PORT) is already in use"; exit 1;)

.PHONY: docgen
docgen: check-port install compose-up ## Generate the openapi.json file.
	AUTH_CLIENT_URL=https://my-app.com AUTH_LOG_LEVEL=error AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS= pnpm dev &
	while [[ "$$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:$(PORT)/healthz)" != "200" ]]; do sleep 1; done
	curl http://localhost:$(PORT)/openapi.json | json_pp > docs/openapi.json
	kill -9 $$(lsof -t -i tcp:$(PORT))
	make compose-down


.PHONY: watch
watch: check-port install compose-up ## Start tests in watch mode.
	bash -c "trap 'make compose-down' EXIT; pnpm test:watch"


.PHONY: build
build: 
	docker build -t $(IMAGE) .


.PHONY: compose-down 
compose-up: ## Start required services (Hasura, Postgres, Mailhog).
	docker-compose -f docker-compose.yaml up -d
	while [[ "$$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:8080/healthz)" != "200" ]]; do sleep 1; done
	@echo "Hasura is ready";


.PHONY: compose-down
compose-down:  ## Stop required services (Hasura, Posgres, Mailhbg).
	docker-compose -f docker-compose.yaml down


.PHONY: install
install: 
	pnpm install

