ROOT_DIR?=$(abspath ../)
include $(ROOT_DIR)/build/makefiles/general.makefile


.PHONY: _dev-env-up
_dev-env-up:
	./dev-env-cli.sh up


.PHONY: _dev-env-down
_dev-env-down:
	./dev-env-cli.sh down


.PHONY: _dev-env-build
_dev-env-build: build-docker-image
