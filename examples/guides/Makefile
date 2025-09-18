ROOT_DIR?=$(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile


.PHONY: _dev-env-up
_dev-env-up:
	cd ./backend/ && $(ROOT_DIR)/examples/demos/backend/env-up.sh


.PHONY: _dev-env-down
_dev-env-down:
	cd ./backend/ && nhost down --volumes


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"
