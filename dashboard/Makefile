NAME:=$(shell basename $(CURDIR))
ifdef VER
VERSION=$(shell echo $(VER) | sed -e 's/^v//g' -e 's/\//_/g')
else
VERSION=$(shell grep -oP 'version\s*=\s*"\K[^"]+' project.nix | head -n 1)
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



.PHONY: dev-env-up
dev-env-up:
	echo "Nothing to do here"


.PHONY: build-docker-image
build-docker-image:
	nix build $(docker-build-options) \
		.\#packages.$(HOST_ARCH)-linux.dashboard-docker-image \
		--print-build-logs
	skopeo copy --insecure-policy dir:./result docker-daemon:$(NAME):$(VERSION)

.PHONY: build
build:
	nix build \
		--print-build-logs \
		.\#dashboard


.PHONY: check
check:
	pnpm run lint # linting
	pnpm run test # unit tests
	# e2e missing
