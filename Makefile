ifeq ($(shell uname -m),x86_64)
  HOST_ARCH?=x86_64
  ARCH?=amd64
else ifeq ($(shell uname -m),arm64)
  HOST_ARCH?=aarch64
  ARCH?=arm64
endif

ifeq ($(shell uname -o),Darwin)
  OS?=darwin
else
  OS?=linux
endif

VER=$(shell echo $(VERSION) | sed -e 's/\//_/g')


.PHONY: check
check:  ## Run nix flake check
	@sed -i 's/$$NHOST_PAT/$(NHOST_PAT)/' get_access_token.sh
	nix flake check --print-build-logs


.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	nix build $(docker-build-options) \
		.\#cli-$(ARCH)-$(OS) \
		--print-build-logs


.PHONY: build-docker-image
build-docker-image:  ## Build docker image
	nix build $(docker-build-options) \
		.\#packages.$(HOST_ARCH)-linux.docker-image-$(ARCH) \
		--print-build-logs
	docker load < result


.PHONY: get-version
get-version:  ## Return version
	@echo $(VER) > VERSION
	@echo $(VER)
