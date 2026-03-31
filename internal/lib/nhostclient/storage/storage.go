//go:generate oapi-codegen -generate types,client -response-type-suffix R -package storage -o storage.gen.go ../../../../services/storage/controller/openapi.yaml
package storage
