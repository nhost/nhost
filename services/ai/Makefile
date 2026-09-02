ROOT_DIR ?= $(abspath ../..)
include $(ROOT_DIR)/build/makefiles/general.makefile

DEMO_MOVIES_PATH=build/demo-movies
DOCKER_DEV_ENV_PATH=build/dev/docker


.PHONY: _dev-env-build
_dev-env-build: build-docker-image


.PHONY: _dev-env-up
_dev-env-up:
	docker compose -f $(DOCKER_DEV_ENV_PATH)/docker-compose.yaml \
		--project-name ai-dev \
		up -d --wait --wait-timeout 120


.PHONY: _dev-env-down
_dev-env-down:
	docker compose -f $(DOCKER_DEV_ENV_PATH)/docker-compose.yaml \
		--project-name ai-dev \
		down --volumes


.PHONY: dev-env-up-short
dev-env-up-short:  ## Starts development environment without the AI service
	docker compose -f $(DOCKER_DEV_ENV_PATH)/docker-compose.yaml \
		--project-name ai-dev \
		up -d --wait --wait-timeout 120 \
		postgres graphql auth storage


.PHONY: migrations-add
migrations-add:  ## Add a migration with MIGRATION_NAME in the migrations folder
	migrate create -dir ./migrations/postgres -ext sql -seq $(MIGRATION_NAME)


.PHONY: demo-movies-up
demo-movies-up:  ## Starts the movies demo environment
	cd $(DEMO_MOVIES_PATH) && nhost up
	$(MAKE) demo-movies-restore-backup


.PHONY: demo-movies-down
demo-movies-down:  ## Stops the movies demo environment
	cd $(DEMO_MOVIES_PATH) && nhost down --volumes
	rm -rf $(DEMO_MOVIES_PATH)/.nhost


.PHONY: demo-movies-restore-backup
demo-movies-restore-backup:  ## Restores the movies demo data backup
	pg_restore --format=custom \
		$(DEMO_MOVIES_PATH)/data/full/01-movies.backup \
		--schema=public \
		--clean --if-exists --no-owner --no-privileges \
		--dbname=local --host=localhost --port=5432 --username=postgres
	psql postgres://postgres:postgres@localhost:5432/local \
		-f $(DEMO_MOVIES_PATH)/data/full/02-auto-embeddings-configuration.sql
	# Restart after the restore because restoring a backup doesn't trigger configuration events.
	docker restart demo-movies-ai-1


.PHONY: quickstart-movies-up
quickstart-movies-up:  ## Starts the movies quickstart environment
	cd $(DEMO_MOVIES_PATH) && nhost up
	psql postgres://postgres:postgres@localhost:5432/local -f $(DEMO_MOVIES_PATH)/data/quickstart.sql
	cd $(DEMO_MOVIES_PATH) && nhost dev hasura metadata reload \
		--endpoint https://local.hasura.nhost.run --admin-secret "nhost-admin-secret"
	cd $(DEMO_MOVIES_PATH) && nhost dev hasura metadata inconsistency drop \
		--endpoint https://local.hasura.nhost.run --admin-secret "nhost-admin-secret"
	$(MAKE) quickstart-movies-restore-backup


.PHONY: quickstart-movies-down
quickstart-movies-down:  ## Stops the movies quickstart environment
	cd $(DEMO_MOVIES_PATH) && nhost down --volumes
	rm -rf $(DEMO_MOVIES_PATH)/.nhost


.PHONY: quickstart-movies-restore-backup
quickstart-movies-restore-backup:  ## Restores the movies quickstart data backup
	pg_restore --format=custom \
		$(DEMO_MOVIES_PATH)/data/qs/01-movies.backup \
		--schema=public \
		--clean --if-exists --no-owner --no-privileges \
		--dbname=local --host=localhost --port=5432 --username=postgres
	psql postgres://postgres:postgres@localhost:5432/local \
		-f $(DEMO_MOVIES_PATH)/data/quickstart.sql
	cd $(DEMO_MOVIES_PATH) && nhost dev hasura metadata inconsistency drop \
		--endpoint https://local.hasura.nhost.run --admin-secret "nhost-admin-secret"
