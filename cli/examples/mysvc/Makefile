IMAGE_NAME ?= mysvc
IMAGE_TAG ?= dev

.PHONY: build
build: ## Build the Docker image
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
