package openai_test

import (
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai"
	"github.com/nhost/nhost/services/ai/openai/api"
)

func TestGraphqlQueryToFunctionsObject(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		gql         *model.GraphiteAssistantToolGraphQLInput
		expected    api.FunctionObject
		expectedErr error
	}{
		{
			name: "no arguments",
			gql: &model.GraphiteAssistantToolGraphQLInput{
				Name:        "GetMoviesScore",
				Description: "some description",
				Query: `query GetMoviesScore {
                  movies {
                    name
                    score
                  }
                }`,
				Arguments: []*model.GraphiteAssistantToolArgumentInput{},
			},
			expected: api.FunctionObject{
				Name:        "GetMoviesScore",
				Description: new("some description"),
				Parameters: &api.FunctionParameters{
					"properties": map[string]any{},
					"required":   []string{},
					"type":       string("object"),
				},
			},
			expectedErr: nil,
		},
		{
			name: "with arguments",
			gql: &model.GraphiteAssistantToolGraphQLInput{
				Name:        "GetMoviesWithScoreHigherThan",
				Description: "some description",
				Query: `query GetMoviesWithScoreHigherThan($score: numeric!) {
                  movies(where: {score: {_gt: $score}}) {
                    name
                    overview
                    score
                  }
                }`,
				Arguments: []*model.GraphiteAssistantToolArgumentInput{
					{
						Name:        "score",
						Description: "Score",
						Type:        "numeric",
						Required:    true,
					},
				},
			},
			expected: api.FunctionObject{
				Name:        "GetMoviesWithScoreHigherThan",
				Description: new("some description"),
				Parameters: &api.FunctionParameters{
					"properties": map[string]any{
						"score": map[string]any{
							"description": string("Score"),
							"type":        string("numeric"),
						},
					},
					"required": []string{"score"},
					"type":     string("object"),
				},
			},
			expectedErr: nil,
		},
		{
			name: "more than one operation",
			gql: &model.GraphiteAssistantToolGraphQLInput{
				Name:        "multiple operations",
				Description: "some description",
				Query: `query GetMovies {
                  movies {
                    name
                    score
                  }
                }

                query GetMovies2 {
                  movies {
                    name
                    score
                  }
                }
                `,
				Arguments: []*model.GraphiteAssistantToolArgumentInput{},
			},
			expected:    api.FunctionObject{},
			expectedErr: openai.ErrOneOperationExpected,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actual, err := openai.GraphqlQueryToFunctionsObject(tc.gql)
			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("expected error: %v, got: %v", tc.expectedErr, err)
			}

			if diff := cmp.Diff(tc.expected, actual); diff != "" {
				t.Errorf("unexpected diff: %s", diff)
			}
		})
	}
}

func TestWebhookQueryToFunctionsObject(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		wh          *model.GraphiteAssistantToolWebhookInput
		expected    api.FunctionObject
		expectedErr error
	}{
		{
			name: "webhook",
			wh: &model.GraphiteAssistantToolWebhookInput{
				Name:        "some_webhook",
				Description: "Some Webhook",
				URL:         "https://example.com/webhook",
				Arguments: []*model.GraphiteAssistantToolArgumentInput{
					{
						Name:        "arg0",
						Description: "Argument 0",
						Type:        "Number",
						Required:    true,
					},
					{
						Name:        "arg1",
						Description: "Argument 1",
						Type:        "text",
						Required:    false,
					},
				},
			},
			expected: api.FunctionObject{
				Name:        "some_webhook",
				Description: new("Some Webhook"),
				Parameters: &api.FunctionParameters{
					"properties": map[string]any{
						"arg0": map[string]any{
							"description": string("Argument 0"),
							"type":        string("Number"),
						},
						"arg1": map[string]any{
							"description": string("Argument 1"),
							"type":        string("text"),
						},
					},
					"required": []string{"arg0"},
					"type":     string("object"),
				},
			},
			expectedErr: nil,
		},
		{
			name: "invalid url",
			wh: &model.GraphiteAssistantToolWebhookInput{
				Name:        "some_webhook",
				Description: "Some Webhook",
				URL:         "asd://example",
				Arguments: []*model.GraphiteAssistantToolArgumentInput{
					{
						Name:        "arg0",
						Description: "Argument 0",
						Type:        "Number",
						Required:    true,
					},
					{
						Name:        "arg1",
						Description: "Argument 1",
						Type:        "text",
						Required:    false,
					},
				},
			},
			expected:    api.FunctionObject{},
			expectedErr: openai.ErrInvalidWebhookURL,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := openai.WebhookToFunctionsObject(tc.wh)
			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("expected error: %v, got: %v", tc.expectedErr, err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("unexpected diff: %s", diff)
			}
		})
	}
}
