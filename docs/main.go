package main

import (
	"fmt"
	"os"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"
)

const tpl = `---
title: "%s"
openapi: %s %s
---`

const authReferencePath = "reference/auth"

type OpenAPIMinimal struct {
	Paths map[string]map[string]any
}

type Endpoint struct {
	Method string
	Path   string
}

func (e Endpoint) Filepath() string {
	return authReferencePath + "/" + e.Method + strings.ReplaceAll(e.Path, "/", "-") + ".mdx"
}

func (e Endpoint) Content() string {
	return fmt.Sprintf(tpl, e.Path, e.Method, e.Path)
}

func (e Endpoint) Mintlify() string {
	return `            "` + strings.Replace(e.Filepath(), ".mdx", "", 1) + `",`
}

type Endpoints []Endpoint

func (e Endpoints) Sort() {
	slices.SortFunc(e, func(a, b Endpoint) int {
		if a.Path == b.Path {
			return strings.Compare(a.Method, b.Method)
		}
		return strings.Compare(a.Path, b.Path)
	})
}

func funcReadOpenAPIFile(filepath string) (*OpenAPIMinimal, error) {
	b, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var oam *OpenAPIMinimal
	if err := yaml.Unmarshal(b, &oam); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	return oam, nil
}

func processOAMFiles(oam *OpenAPIMinimal) (Endpoints, error) {
	endpoints := make(Endpoints, 0, len(oam.Paths)*2)

	for path, methods := range oam.Paths {
		for method := range methods {
			e := Endpoint{Method: method, Path: path}
			endpoints = append(endpoints, e)

			if err := os.WriteFile(e.Filepath(), []byte(e.Content()), 0o644); err != nil {
				return nil, fmt.Errorf("failed to write file: %w", err)
			}
		}
	}

	return endpoints, nil
}

func process() error {
	if err := os.RemoveAll(authReferencePath); err != nil {
		return fmt.Errorf("failed to remove directory: %w", err)
	}

	if err := os.Mkdir(authReferencePath, 0o755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	oam, err := funcReadOpenAPIFile("reference/openapi-auth.yaml")
	if err != nil {
		return fmt.Errorf("failed to read openapi-auth.yaml file: %w", err)
	}

	endpoints, err := processOAMFiles(oam)
	if err != nil {
		return fmt.Errorf("failed to process OAM files: %w", err)
	}

	oamOld, err := funcReadOpenAPIFile("reference/openapi-auth-old.yaml")
	if err != nil {
		return fmt.Errorf("failed to read openapi-auth-old.yaml file: %w", err)
	}

	endpointsOld, err := processOAMFiles(oamOld)
	if err != nil {
		return fmt.Errorf("failed to process OAM files: %w", err)
	}

	endpoints = append(endpoints, endpointsOld...)
	endpoints.Sort()

	for _, e := range endpoints {
		fmt.Println(e.Mintlify())
	}

	return nil
}

func main() {
	if err := process(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
