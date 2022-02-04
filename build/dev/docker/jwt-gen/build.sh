#!/bin/sh
GOOS=linux GOARCH=amd64 go build -o jwt-gen.Linux.x86_64 main.go
GOOS=linux GOARCH=arm64 go build -o jwt-gen.Linux.aarch64 main.go
GOOS=darwin GOARCH=amd64 go build -o jwt-gen.Darwin.x86_64 main.go
GOOS=darwin GOARCH=arm64 go build -o jwt-gen.Darwin.arm64 main.go
