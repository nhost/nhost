NAME:=$(shell basename $(CURDIR))
ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' flake.nix | head -n 1)
endif

ifeq ($(shell uname -m),x86_64)
  HOST_ARCH?=x86_64
  ARCH?=amd64
else ifeq ($(shell uname -m),arm64)
  HOST_ARCH?=aarch64
  ARCH?=arm64
else ifeq ($(shell uname -m),aarch64)
  HOST_ARCH?=aarch64
  ARCH?=arm64
endif

ifeq ($(shell uname -o),Darwin)
  OS?=darwin
else
  OS?=linux
endif

ifeq ($(shell uname -o),Darwin)
  OS?=darwin
else
  OS?=linux
endif


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
	@sed -i '/^\s*version = ".*";/s//version = "${VERSION}";/' flake.nix
	@sed -i '/^\s*created = ".*";/s//created = "${shell date --utc '+%Y-%m-%dT%H:%M:%SZ'}";/' flake.nix
	@echo $(VERSION)


.PHONY: check
check:   ## Run nix flake check
	nix flake check --print-build-logs


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	nix build \
		--print-build-logs \
		.\#example-$(HOST_ARCH)-$(OS)


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	nix build $(docker-build-options) \
		.\#packages.$(HOST_ARCH)-linux.docker-image \
		--print-build-logs
	skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME):$(VERSION)
