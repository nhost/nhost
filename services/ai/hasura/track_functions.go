package hasura

import (
	"context"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

type TrackFunctionRequest struct {
	Type string                   `json:"type"`
	Args TrackFunctionRequestArgs `json:"args"`
}

type TrackFunctionRequestArgs struct {
	Source        string                                 `json:"source"`
	Function      TrackFunctionRequestArgsFunction       `json:"function"`
	Configuration *TrackFunctionRequestArgsConfiguration `json:"configuration,omitempty"`
}

type TrackFunctionRequestArgsFunction struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
}

//nolint:tagliatelle
type TrackFunctionRequestArgsConfiguration struct {
	CustomRootFields TrackFunctionRequestArgsConfigurationCustomRootFields `json:"custom_root_fields"`
	ExposeAs         string                                                `json:"expose_as"`
}

//nolint:tagliatelle
type TrackFunctionRequestArgsConfigurationCustomRootFields struct {
	Function          string `json:"function"`
	FunctionAggregate string `json:"function_aggregate"`
}

func snakeToCamel(s string) string {
	words := strings.Split(s, "_")
	for i := 1; i < len(words); i++ {
		words[i] = cases.Title(language.English).String(words[i])
	}

	return strings.Join(words, "")
}

func (c *Client) TrackFunction(ctx context.Context, schemaName, functionName string) error {
	camelCaseName := snakeToCamel(functionName)
	req := TrackFunctionRequest{
		Type: "pg_track_function",
		Args: TrackFunctionRequestArgs{
			Source: "default",
			Function: TrackFunctionRequestArgsFunction{
				Schema: schemaName,
				Name:   functionName,
			},
			Configuration: &TrackFunctionRequestArgsConfiguration{
				ExposeAs: "query",
				CustomRootFields: TrackFunctionRequestArgsConfigurationCustomRootFields{
					Function:          camelCaseName,
					FunctionAggregate: camelCaseName + "Aggregate",
				},
			},
		},
	}

	var resp any

	return c.QueryMetadata(ctx, req, &resp)
}

func (c *Client) UntrackFunction(ctx context.Context, schemaName, functionName string) error {
	req := TrackFunctionRequest{
		Type: "pg_untrack_function",
		Args: TrackFunctionRequestArgs{
			Source: "default",
			Function: TrackFunctionRequestArgsFunction{
				Schema: schemaName,
				Name:   functionName,
			},
			Configuration: nil,
		},
	}

	var resp any

	return c.QueryMetadata(ctx, req, &resp)
}
