TAG_NAME?=$(NAME)
TAG_PATTERN="^$(TAG_NAME)@\d+\.\d+\.\d+$$"


.PHONY: changelog-init
changelog-init:  ## Initialize changelog using git-cliff
	@git cliff -u --tag-pattern "$(TAG_PATTERN)" --bump --tag="$(NAME)/$(VERSION)" --output CHANGELOG.md

.PHONY: changelog-next-version
changelog-next-version:  ## Get next version using git-cliff
	@git cliff -u --bumped-version --tag-pattern $(TAG_PATTERN) $(CLIFF_OPTS) | awk -F\@ '{print $$2}'

.PHONY: changelog-get-released
changelog-get-released:  ## Get changelog for the latest release using git-cliff
	@git cliff -l --bump --tag-pattern $(TAG_PATTERN) $(CLIFF_OPTS) --strip all


.PHONY: changelog-get-unreleased
changelog-get-unreleased:  ## Get changelog for the following release using git-cliff
	@git cliff -u --bump --tag-pattern $(TAG_PATTERN) $(CLIFF_OPTS) --strip all


.PHONY: changelog-update
changelog-update:  ## Update changelog using git-cliff
	@git cliff -u --bump --tag-pattern $(TAG_PATTERN) $(CLIFF_OPTS) --prepend CHANGELOG.md


.PHONY: release-tag-name
release-tag-name:  ## Get the tag name for the current version
	echo "$(TAG_NAME)"
