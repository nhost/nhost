package openapi

import (
	"fmt"
	"os"
	"regexp"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"
)

const tpl = `---
title: "%s"
openapi: %s %s
---`

type OpenAPIMinimal struct { //nolint:revive
	Paths map[string]map[string]any
}

type Endpoint struct {
	Method string
	Path   string
}

func (e Endpoint) Filepath(outDir string) string {
	re := regexp.MustCompile(`[/.]`)
	return outDir + "/" + e.Method + re.ReplaceAllString(e.Path, "-") + ".mdx"
}

func (e Endpoint) Content() string {
	return fmt.Sprintf(tpl, e.Path, e.Method, e.Path)
}

func (e Endpoint) Mintlify(outDir string) string {
	return `            "` + strings.Replace(e.Filepath(outDir), ".mdx", "", 1) + `",`
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

func processOAMFiles(oam *OpenAPIMinimal, outDir string) (Endpoints, error) {
	endpoints := make(Endpoints, 0, len(oam.Paths)*2) //nolint:mnd

	for path, methods := range oam.Paths {
		for method := range methods {
			e := Endpoint{Method: method, Path: path}
			endpoints = append(endpoints, e)

			if err := os.WriteFile(e.Filepath(outDir), []byte(e.Content()), 0o644); err != nil { //nolint:gosec,mnd
				return nil, fmt.Errorf("failed to write file: %w", err)
			}
		}
	}

	return endpoints, nil
}

func process(openAPISpec, outDir string) error {
	if err := os.RemoveAll(outDir); err != nil {
		return fmt.Errorf("failed to remove directory: %w", err)
	}

	if err := os.Mkdir(outDir, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create directory: %w", err)
	}

	oam, err := funcReadOpenAPIFile(openAPISpec)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	endpoints, err := processOAMFiles(oam, outDir)
	if err != nil {
		return fmt.Errorf("failed to process OAM files: %w", err)
	}

	slices.SortFunc(endpoints, func(a, b Endpoint) int {
		return strings.Compare(a.Path, b.Path)
	})

	for _, e := range endpoints {
		fmt.Println(e.Mintlify(outDir)) //nolint:forbidigo
	}

	return nil
}
