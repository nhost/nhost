PROJ_DIR=$(abspath .)
PROJ=$(subst $(ROOT_DIR)/,,$(PROJ_DIR))
NAME=$(notdir $(PROJ))

OUT_LINK?=result
NIX_PACKAGE_ATTR?=$(NAME)
NIX_DOCKER_ATTR?=$(NAME)-docker-image
DOCKER_IMAGE_NAME?=$(NAME)
LOAD_DOCKER_IMAGE?=true

include $(ROOT_DIR)/build/makefiles/release.makefile

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


.PHONY: develop
develop:  ## Start a nix develop shell
	nix develop .\#$(NAME)


.PHONY: _check-pre
_check-pre:  ## Pre-checks before running nix flake check


NIX_CHECK_EXTRA_ARGS?=
# CI can retain a check from before release metadata was stamped.
CHECK_INSTALLABLE=.\#checks.$(ARCH)-$(OS).$(NAME)
ifdef CHECK_DRV
CHECK_INSTALLABLE=$(CHECK_DRV)^*
endif

.PHONY: check
check: _check-pre ## Run nix flake check
	nix build \
		--out-link "$(OUT_LINK)" \
		--print-build-logs \
		$(NIX_CHECK_EXTRA_ARGS) \
		"$(CHECK_INSTALLABLE)"


.PHONY: check-dry-run
check-dry-run: SHELL := bash
check-dry-run: .SHELLFLAGS := -o pipefail -c
check-dry-run:  ## Returns the derivation of the check
	@nix build \
		--dry-run \
		--json \
		$(NIX_CHECK_EXTRA_ARGS) \
		"$(CHECK_INSTALLABLE)" | jq -r '.[].outputs.out'


.PHONY: check-derivation
check-derivation:  ## Resolve the check with project-specific evaluation flags
	@nix path-info --derivation $(NIX_CHECK_EXTRA_ARGS) .\#checks.$(ARCH)-$(OS).$(NAME)


.PHONY: check-shell-derivation
check-shell-derivation:  ## Resolve the development shell before version stamping
	@nix path-info --derivation $(NIX_CHECK_EXTRA_ARGS) .\#devShells.$(ARCH)-$(OS).$(NAME)


.PHONY: cache-check-roots
cache-check-roots:  ## Record check and development shell derivations
	@nix path-info --derivation $(NIX_CHECK_EXTRA_ARGS) \
		.\#checks.$(ARCH)-$(OS).$(NAME) \
		.\#devShells.$(ARCH)-$(OS).$(NAME)


.PHONY: cache-build-roots
cache-build-roots:  ## Record package derivation before building
	@nix path-info --derivation .\#packages.$(ARCH)-$(OS).$(NIX_PACKAGE_ATTR)


.PHONY: cache-image-roots
cache-image-roots:  ## Record image and image-loader derivations
	@nix path-info --derivation .\#packages.$(ARCH)-linux.$(NIX_DOCKER_ATTR) \
		$(if $(filter true,$(LOAD_DOCKER_IMAGE)),.\#devShells.$(ARCH)-$(OS).skopeo)


.PHONY: get-docker-image-tag
get-docker-image-tag:
	@echo "$(DOCKER_IMAGE_NAME):$(VERSION)"


.PHONY: build
build:  ## Build application (OUT_LINK defaults to result)
	nix build \
		--out-link "$(OUT_LINK)" \
		--print-build-logs \
		.\#packages.$(ARCH)-$(OS).$(NIX_PACKAGE_ATTR)


.PHONY: build-dry-run
build-dry-run: SHELL := bash
build-dry-run: .SHELLFLAGS := -o pipefail -c
build-dry-run:  ## Run nix flake check
	@nix build \
		--dry-run \
		--json \
		.\#packages.$(ARCH)-$(OS).$(NIX_PACKAGE_ATTR) | jq -r '.[].outputs.out'


.PHONY: build-nixops-dry-run
build-nixops-dry-run:  ## Checks if nixops needs to be rebuilt
	@nix build \
		--dry-run \
		--json \
		.\#packages.$(ARCH)-$(OS).nixops | jq -r '.[].outputs.out'


.PHONY: build-docker-image
build-docker-image:  ## Build docker container for native architecture
	@# Integration setup can build auxiliary images; retain each exact graph.
	@if [ -n "$${NIX_CACHE_ROOTS:-}" ]; then \
		$(MAKE) --no-print-directory cache-image-roots >> "$$NIX_CACHE_ROOTS"; \
	fi
	nix build $(docker-build-options) --show-trace \
		--out-link "$(OUT_LINK)" \
		.\#packages.$(ARCH)-linux.$(NIX_DOCKER_ATTR) \
		--print-build-logs
	@if [ "$(LOAD_DOCKER_IMAGE)" != true ]; then \
		echo "Image import not needed"; \
	elif [ -n "$${PREBUILT_DOCKER_IMAGE_PATH:-}" ] && \
		[ "$$(nix path-info "$(abspath $(OUT_LINK))")" = "$$PREBUILT_DOCKER_IMAGE_PATH" ] && \
		[ -n "$${PREBUILT_DOCKER_IMAGE_ID:-}" ] && \
		[ "$$(docker image inspect --format '{{.Id}}' "$(DOCKER_IMAGE_NAME):$(VERSION)" 2>/dev/null || true)" = "$$PREBUILT_DOCKER_IMAGE_ID" ]; then \
		echo "Reusing prebuilt Docker image $(DOCKER_IMAGE_NAME):$(VERSION)"; \
	else \
		nix develop \#skopeo -c \
			skopeo copy --insecure-policy "dir:$(OUT_LINK)" "docker-daemon:$(DOCKER_IMAGE_NAME):$(VERSION)"; \
	fi


.PHONY: build-docker-image-import-bare
build-docker-image-import-bare:
	skopeo copy --insecure-policy "dir:$(OUT_LINK)" "docker-daemon:$(DOCKER_IMAGE_NAME):$(VERSION)"


.PHONY: dev-env-up
dev-env-up: _dev-env-build ## Starts development environment
	$(MAKE) _dev-env-up


.PHONY: dev-env-down
dev-env-down: _dev-env-down  ## Stops development environment


.PHONY: dev-env-build
dev-env-build: _dev-env-build  ## Builds development environment
