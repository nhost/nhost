//go:generate oapi-codegen -generate types,client -response-type-suffix R -package auth -o auth.gen.go ../../../../services/auth/docs/openapi.yaml
package auth
