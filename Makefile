ifeq ($(shell uname -m),x86_64)
  ARCH?=x86_64
else ifeq ($(shell uname -m),arm64)
  ARCH?=aarch64
endif

ifeq ($(shell uname -o),Darwin)
  OS?=darwin
else
  OS?=linux
endif

.PHONY: check
check:  ## Run nix flake check
	sed -i 's/$$NHOST_PAT/$(NHOST_PAT)/' get_access_token.sh
	nix build \
		--print-build-logs \
		.\#checks.$(ARCH)-$(OS).go

.PHONY: build
build:  ## Build application and places the binary under ./result/bin
	nix build \
		.\#packages.$(ARCH)-$(OS).cli \
		--print-build-logs

.PHONY: get-version
get-version:  ## Return version
	@echo $(VERSION) > VERSION
	@echo $(VERSION)
