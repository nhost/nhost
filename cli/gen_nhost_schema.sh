#!/bin/sh
# This script generates the GraphQL schema for Nhost and saves it to a file.
# This is only needed if the filter in cmd/gen/gen.go is changed.

go run main.go gen > tools/cloud/schema.graphql
go run main.go gen --with-mutations > tools/cloud/schema-with-mutations.graphql
