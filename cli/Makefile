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


ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' flake.nix | head -n 1)
endif


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
	skopeo copy --insecure-policy \
		--override-arch $(ARCH) \
		dir:./result docker-daemon:nhost/cli:$(VERSION)


.PHONY: get-version
get-version:  ## Return version
	@sed -i '/^\s*version = "0.0.0-dev";/s//version = "${VERSION}";/' flake.nix
	@sed -i '/^\s*created = "1970-.*";/s//created = "${shell date --utc '+%Y-%m-%dT%H:%M:%SZ'}";/' flake.nix
	@echo $(VERSION)
