PROJ_DIR=$(abspath .)
PROJ=$(subst $(ROOT_DIR)/,,$(PROJ_DIR))
NAME=$(notdir $(PROJ))

ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' project.nix | head -n 1)
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

ifeq ($(CI),true)
  docker-build-options=--option system $(ARCH)-linux --extra-platforms ${ARCH}-linux
endif


.PHONY: help
help: ## Show this help.
	@echo
	@awk 'BEGIN { \
		FS = "##"; \
		printf "Usage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z_-]+%?:.*?##/ { printf "  \033[36m%-38s\033[0m %s\n", $$1, $$2 } ' \
		$(MAKEFILE_LIST)

.PHONY: print-vars
print-vars:  ## print all variables
	@$(foreach V,$(sort $(.VARIABLES)), \
	   $(if $(filter-out environment% default automatic, \
	   $(origin $V)),$(info $V=$($V) ($(value $V)))))


.PHONY: get-version
get-version:  ## Return version
	@sed -i '/^\s*version = "0.0.0-dev";/s//version = "${VERSION}";/' project.nix
	@sed -i '/^\s*created = "1970-.*";/s//created = "${shell date --utc '+%Y-%m-%dT%H:%M:%SZ'}";/' project.nix
	@echo $(VERSION)


.PHONY: check
check:  ## Run nix flake check
	nix build \
		--print-build-logs \
		.\#checks.$(ARCH)-$(OS).$(NAME)


.PHONY: check-dry-run
check-dry-run:  ## Returns the derivation of the check
	@nix build \
		--dry-run \
		--json \
		--print-build-logs \
		.\#checks.$(ARCH)-$(OS).$(NAME) | jq -r '.[].outputs.out'


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	nix build \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).$(NAME)


.PHONY: build-dry-run
build-dry-run:  ## Run nix flake check
	nix build \
		--dry-run \
		--json \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).$(NAME)


.PHONY: build-nixops-dry-run
build-nixops-dry-run:  ## Checks if nixops needs to be rebuilt
	nix build \
		--dry-run \
		--json \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).nixops


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	nix build $(docker-build-options) --show-trace \
		.\#packages.$(ARCH)-linux.$(NAME)-docker-image \
		--print-build-logs
	nix develop \#skopeo -c \
		skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME):$(VERSION)


.PHONY: dev-env-up
dev-env-up: _dev-env-build _dev-env-up ## Starts development environment


.PHONY: dev-env-down
dev-env-down: _dev-env-down  ## Stops development environment


.PHONY: dev-env-build
dev-env-build: _dev-env-build  ## Builds development environment
