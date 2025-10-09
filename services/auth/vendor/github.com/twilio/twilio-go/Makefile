.PHONY: githooks install test test-docker goimports govet golint docker-build docker-push cover

githooks:
	ln -sf ../../githooks/pre-commit .git/hooks/pre-commit

install:
	go build -v ./...

test:
	go test -race ./...

test-docker:
	docker build -t twilio/twilio-go .
	docker run twilio/twilio-go go test -race ./...

cluster-test:
	go test -trimpath -race --tags=cluster ./...

webhook-cluster-test:
	go test -race --tags=webhook_cluster

goimports:
	go install golang.org/x/tools/cmd/goimports@v0.24.0
	goimports -w .
	go mod tidy

govet: goimports
	go vet ./...

golint: govet
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.39.0
	golangci-lint run

API_DEFINITIONS_SHA=$(shell git log --oneline | grep Regenerated | head -n1 | cut -d ' ' -f 5)
CURRENT_TAG=$(shell [[ "${GITHUB_TAG}" == *"-rc"* ]] && echo "rc" || echo "latest")
docker-build:
	docker build -t twilio/twilio-go .
	docker tag twilio/twilio-go twilio/twilio-go:${GITHUB_TAG}
	docker tag twilio/twilio-go twilio/twilio-go:apidefs-${API_DEFINITIONS_SHA}
	docker tag twilio/twilio-go twilio/twilio-go:${CURRENT_TAG}

docker-push:
	docker push twilio/twilio-go:${GITHUB_TAG}
	docker push twilio/twilio-go:apidefs-${API_DEFINITIONS_SHA}
	docker push twilio/twilio-go:${CURRENT_TAG}

GO_DIRS = $(shell go list ./... | grep -v /rest/ | grep -v /form )
cover:
	go test ${GO_DIRS} -coverprofile coverage.out
	go test ${GO_DIRS} -json > test-report.out
