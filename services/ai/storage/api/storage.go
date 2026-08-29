//go:generate oapi-codegen -generate types,client -response-type-suffix R -package api -include-tags storage -o storage.gen.go storage.yaml
package api //nolint:revive
