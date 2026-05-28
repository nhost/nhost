ROOT_DIR?=$(abspath ../../)
include $(ROOT_DIR)/build/makefiles/general.makefile

GH_EXTENSIONS_DIR?=$(HOME)/.local/share/gh/extensions/gh-activity


.PHONY: install
install: build  ## Install as a gh extension at $(GH_EXTENSIONS_DIR)/gh-activity
	mkdir -p $(GH_EXTENSIONS_DIR)
	install -m 0755 result/bin/gh-activity $(GH_EXTENSIONS_DIR)/gh-activity


.PHONY: _dev-env-up
_dev-env-up:
	@echo "Nothing to do"


.PHONY: _dev-env-down
_dev-env-down:
	@echo "Nothing to do"


.PHONY: _dev-env-build
_dev-env-build:
	@echo "Nothing to do"
