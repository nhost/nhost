package hasura

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/goccy/go-yaml"
)

func loadActionMetadataYAML(
	ctx context.Context,
	baseDir string,
) ([]ActionMetadata, CustomTypes, []LoadDiagnostic) {
	actionsPath := filepath.Join(baseDir, "actions.yaml")

	data, err := readFileFrom(ctx)(actionsPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, emptyCustomTypes(), nil
	}

	if err != nil {
		return nil, emptyCustomTypes(), []LoadDiagnostic{actionFileDiagnostic(
			"actions.yaml",
			fmt.Sprintf("failed to read file %s: %v", actionsPath, err),
		)}
	}

	var parsed actionsYAMLMetadata
	if err := yaml.UnmarshalContext(ctx, data, &parsed); err != nil {
		return nil, emptyCustomTypes(), []LoadDiagnostic{actionFileDiagnostic(
			"actions.yaml",
			fmt.Sprintf("failed to unmarshal actions.yaml: %v", err),
		)}
	}

	sdl, diagnostics := loadActionSDL(ctx, baseDir, &parsed)
	if len(diagnostics) > 0 {
		return nil, emptyCustomTypes(), diagnostics
	}

	if err := mergeActionsYAMLWithSDL(&parsed, sdl); err != nil {
		return nil, emptyCustomTypes(), []LoadDiagnostic{actionFileDiagnostic(
			"actions.graphql",
			err.Error(),
		)}
	}

	return parsed.Actions, parsed.CustomTypes, nil
}

func loadActionSDL(
	ctx context.Context,
	baseDir string,
	parsed *actionsYAMLMetadata,
) (*actionSDLMetadata, []LoadDiagnostic) {
	sdlPath := filepath.Join(baseDir, "actions.graphql")

	data, err := readFileFrom(ctx)(sdlPath)
	if errors.Is(err, fs.ErrNotExist) {
		if actionsNeedSDL(parsed.Actions) || customTypesNeedSDL(parsed.CustomTypes) {
			return nil, []LoadDiagnostic{actionFileDiagnostic(
				"actions.graphql",
				errActionSDLRequired.Error(),
			)}
		}

		return nil, nil
	}

	if err != nil {
		return nil, []LoadDiagnostic{actionFileDiagnostic(
			"actions.graphql",
			fmt.Sprintf("failed to read file %s: %v", sdlPath, err),
		)}
	}

	sdl, err := parseActionSDL(data)
	if err != nil {
		return nil, []LoadDiagnostic{actionFileDiagnostic("actions.graphql", err.Error())}
	}

	return sdl, nil
}

func actionFileDiagnostic(name, reason string) LoadDiagnostic {
	return LoadDiagnostic{
		Kind:   loadDiagnosticKindAction,
		Source: "",
		Name:   name,
		Reason: reason,
	}
}
