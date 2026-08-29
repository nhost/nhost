//go:generate oapi-codegen -generate types,client -response-type-suffix R -package api -include-tags "Assistants,Embeddings,Files,Vector Stores" -o openai.gen.go openai.yaml
package api //nolint:revive
