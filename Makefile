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

.PHONY: build-nixops-dry-run
build-nixops-dry-run:  ## Checks if nixops needs to be rebuilt
	@nix build \
		--dry-run \
		--json \
		.\#packages.$(ARCH)-$(OS).nixops | jq -r '.[].outputs.out'

.PHONY: envrc-install
envrc-install: ## Copy envrc.sample to all project folders
	@for f in $$(find . -name "project.nix"); do \
		echo "Copying envrc.sample to $$(dirname $$f)/.envrc"; \
		cp ./envrc.sample $$(dirname $$f)/.envrc; \
	done

.PHONY: nixops-container-env
nixops-container-env: ## Enter a NixOS container environment
	docker run \
		-it \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v ./:/build \
		-w /build \
		nixops:0.0.0-dev \
			bash
