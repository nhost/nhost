package openai_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai"
	"github.com/nhost/nhost/services/ai/openai/api"
	"github.com/nhost/nhost/services/ai/openai/mock"
	"go.uber.org/mock/gomock"
)

type jsonComparer[T any] struct {
	want T
	diff string
}

func JSONComparer[T any](want T) *jsonComparer[T] {
	return &jsonComparer[T]{want, ""}
}

func (c *jsonComparer[T]) Matches(x any) bool {
	gotb, _ := json.MarshalIndent(x, "", "  ")      //nolint:errchkjson
	want, _ := json.MarshalIndent(c.want, "", "  ") //nolint:errchkjson
	c.diff = cmp.Diff(string(gotb), string(want))

	return c.diff == ""
}

func (c *jsonComparer[T]) String() string {
	return c.diff
}

func TestAssistantsGetOld(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		client      func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface
		cclient     func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface
		expected    *model.GraphiteAssistant
		expectedErr error
	}{
		{
			name: "found",
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "id": "asst_PDLWuG2pQ68ZPlFuK7oXMLVp",
                      "object": "assistant",
                      "created_at": 1700578834,
                      "name": "test-assistant",
                      "description": "Test Assistant",
                      "model": "gpt-3.5-turbo-1106",
                      "instructions": "You are a test assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "type": "function",
                          "function": {
                            "name": "GetMoviesWithScoreHigherThan",
                            "description": "get movies with higher score than the input",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          }
                        },
                        {
                          "type": "function",
                          "function": {
                            "name": "test webhook",
                            "description": "some description for the webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          }
                        }
                      ],
                      "metadata": {
                        "graphql-0": "H4sIAAAAAAAA/3yPQWr0MAyFr6Jf/Isp5AS+QLvpqoUuSilu5hFrYTujyAlD8N2LndBNoSsZ9D0/fTsnH8GOH2HPeRUsb2LhZcyKJ5kC9DX4xANfsYwqs0lO7HiCUew0bWKBQkdpaTGy4BNZAEmai/HAtwK9szsm/VV0+d+/cJRKhMr474F2OpsuW0Bb7Seyf07m6AjU2kGiJtNmXqGrYGvv46paeWCvU4lItrB7/zHv+1+Kp0umMcfZK8hPXtLSfOw+t1wq8QvKAytuRRRXdqYF9aN+BwAA///KhJWLVQEAAA==",
                        "managed-by": "graphite",
                        "webhook-0": "H4sIAAAAAAAA/0yNsQoCMRAFfyW8+jD9foOVYCUW8XyaQzcbsisK4r+LYHHtMMO80YoSgqBHevJUzW6YcKbPY+mxWIPATZlWKF1spKhcBfvdFoIa0V1y5qtov3Mzm+a/4/m3wIQyrg9lC4ccjp9vAAAA//+uuKItgQAAAA=="
                      }
                }`)

				var obj api.AssistantObject
				if err := json.Unmarshal(body, &obj); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().GetAssistantWithResponse(
					gomock.Any(),
					"assistant-id",
				).Return(
					&api.GetAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &obj,
					},
					nil,
				)

				return mock
			},
			expected: &model.GraphiteAssistant{
				AssistantID:  "asst_PDLWuG2pQ68ZPlFuK7oXMLVp",
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-3.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQl{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",

						Query: "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgument{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},

				Webhooks: []*model.GraphiteAssistantToolWebhook{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgument{},
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "not found",
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				mock.EXPECT().GetAssistantWithResponse(
					gomock.Any(),
					"assistant-id",
				).Return(
					&api.GetAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusNotFound,
						},
						JSON200: nil,
					},
					nil,
				)

				return mock
			},
			expected:    nil,
			expectedErr: openai.ErrNotfound,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			client := tc.client(ctrl)
			cclient := tc.cclient(ctrl)

			oai := openai.New(
				client,
				cclient,
				"http://graphql:8080/v1/graphql",
				"adminSecret",
				"pgConnStr",
			)

			assistant, err := oai.AssistantsGetOld(t.Context(), "assistant-id")
			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("expected error: %v, got: %v", tc.expectedErr, err)
			}

			if diff := cmp.Diff(tc.expected, assistant); diff != "" {
				t.Errorf("unexpected assistant (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAssistantsCreate(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name        string
		input       model.GraphiteAssistantInput
		client      func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface
		cclient     func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface
		expectedErr error
	}{
		{
			name: "created",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-3.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "some-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-3.5-turbo-1106",
                      "name": "test-assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        }
                      ]
                    }`)

				var req api.CreateAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				body = []byte(`{
                      "id": "asst_vFOChYBxsWsBn3eFgj2QVFJZ",
                      "object": "assistant",
                      "created_at": 1700580936,
                      "name": "test-assistant",
                      "description": "Test Assistant",
                      "model": "gpt-3.5-turbo-1106",
                      "instructions": "You are a test assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "type": "function",
                          "function": {
                            "name": "GetMoviesWithScoreHigherThan",
                            "description": "get movies with higher score than the input",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            },
							"strict": null
                          }
                        },
                        {
                          "type": "function",
                          "function": {
                            "name": "test webhook",
                            "description": "some description for the webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            },
							"strict": null
                          }
                        }
                      ],
                      "metadata": {
                        "managed-by": "graphite"
                      }
                    }`)

				var resp api.AssistantObject
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().CreateAssistantWithResponse(
					gomock.Any(),
					JSONComparer(req),
				).Return(
					&api.CreateAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &resp,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: nil,
		},
		{
			name: "wrong request",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-4.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "some-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-4.5-turbo-1106",
                      "name": "test-assistant",
                      "buckets": ["default"],
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        }
                      ]
                    }`)

				var req api.CreateAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().CreateAssistantWithResponse(
					gomock.Any(),
					JSONComparer(req),
				).Return(
					&api.CreateAssistantR{
						Body: []byte(`{
                              "error": {
                                "message": "The requested model 'gpt-4.5-turbo-1106' does not exist.",
                                "type": "invalid_request_error",
                                "param": "model",
                                "code": "model_not_found"
                              }
                            }`),
						HTTPResponse: &http.Response{
							StatusCode: http.StatusBadRequest,
						},
						JSON200: nil,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: &openai.ResponseError{
				StatusCode: 400,
				Message: `{
                              "error": {
                                "message": "The requested model 'gpt-4.5-turbo-1106' does not exist.",
                                "type": "invalid_request_error",
                                "param": "model",
                                "code": "model_not_found"
                              }
                            }`,
			},
		},
		{
			name: "with filestore",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-3.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{"filestore-id"},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "some-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-3.5-turbo-1106",
                      "name": "test-assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "type": "file_search"
                        }
                      ]
                    }`)

				var req api.CreateAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				body = []byte(`{
                      "id": "asst_vFOChYBxsWsBn3eFgj2QVFJZ",
                      "object": "assistant",
                      "created_at": 1700580936,
                      "name": "test-assistant",
                      "description": "Test Assistant",
                      "model": "gpt-3.5-turbo-1106",
                      "instructions": "You are a test assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "type": "function",
                          "function": {
                            "name": "GetMoviesWithScoreHigherThan",
                            "description": "get movies with higher score than the input",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            },
							"strict": null
                          }
                        },
                        {
                          "type": "function",
                          "function": {
                            "name": "test webhook",
                            "description": "some description for the webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            },
							"strict": null
                          }
                        }
                      ],
                      "metadata": {
                        "managed-by": "graphite"
                      }
                    }`)

				var resp api.AssistantObject
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().CreateAssistantWithResponse(
					gomock.Any(),
					JSONComparer(req),
				).Return(
					&api.CreateAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &resp,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			client := tc.client(ctrl)
			cclient := tc.cclient(ctrl)

			oai := openai.New(
				client,
				cclient,
				"http://graphql:8080/v1/graphql",
				"adminSecret",
				"pgConnStr",
			)

			_, err := oai.AssistantsCreate(t.Context(), "some-id", tc.input)
			if !errors.Is(err, tc.expectedErr) {
				if diff := cmp.Diff(tc.expectedErr, err); diff != "" {
					t.Errorf("unexpected error (-want +got):\n%s", diff)
				}
			}
		})
	}
}

func TestAssistantsUpdate(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name        string
		input       model.GraphiteAssistantInput
		client      func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface
		cclient     func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface
		expectedErr error
	}{
		{
			name: "updated",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-3.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "ass-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-3.5-turbo-1106",
                      "name": "test-assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        }
                      ]
                    }`)

				var req api.ModifyAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				body = []byte(`{
                      "id": "asst_vFOChYBxsWsBn3eFgj2QVFJZ",
                      "object": "assistant",
                      "created_at": 1700580936,
                      "name": "test-assistant",
                      "description": "Test Assistant",
                      "model": "gpt-3.5-turbo-1106",
                      "instructions": "You are a test assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "type": "function",
                          "function": {
                            "name": "GetMoviesWithScoreHigherThan",
                            "description": "get movies with higher score than the input",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            },
							"strict": null
                          }
                        },
                        {
                          "type": "function",
                          "function": {
                            "name": "test webhook",
                            "description": "some description for the webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            },
							"strict": null
                          }
                        }
                      ],
                      "file_ids": [],
                      "metadata": {
                        "managed-by": "graphite"
                      }
                    }`)

				var resp api.AssistantObject
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().ModifyAssistantWithResponse(
					gomock.Any(),
					"ass-id",
					JSONComparer(req),
				).Return(
					&api.ModifyAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &resp,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: nil,
		},
		{
			name: "wrong request",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-4.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
		                    "description": "Test Assistant",
		                    "instructions": "You are a test assistant",
		                    "metadata": {
                              "database-id": "ass-id",
		                      "managed-by": "graphite"
		                    },
		                    "model": "gpt-4.5-turbo-1106",
		                    "name": "test-assistant",
                            "tool_resources": {},
		                    "tools": [
		                      {
		                        "function": {
		                          "description": "get movies with higher score than the input",
		                          "name": "GetMoviesWithScoreHigherThan",
		                          "parameters": {
		                            "properties": {
		                              "score": {
		                                "description": "score to compare against",
		                                "type": "number"
		                              }
		                            },
		                            "required": [
		                              "score"
		                            ],
		                            "type": "object"
                             }
                          },
                          "type": "function"
		                      },
		                      {
		                        "function": {
		                          "description": "some description for the webhook",
		                          "name": "test webhook",
		                          "parameters": {
		                            "properties": {},
		                            "required": [],
		                            "type": "object"
                            }
                          },
                          "type": "function"
		                      }
		                    ]
		                  }`)

				var req api.ModifyAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().ModifyAssistantWithResponse(
					gomock.Any(),
					"ass-id",
					JSONComparer(req),
				).Return(
					&api.ModifyAssistantR{
						Body: []byte(`{
		                            "error": {
		                              "message": "The requested model 'gpt-4.5-turbo-1106' does not exist.",
		                              "type": "invalid_request_error",
		                              "param": "model",
		                              "code": "model_not_found"
		                            }
		                          }`),
						HTTPResponse: &http.Response{
							StatusCode: http.StatusBadRequest,
						},
						JSON200: nil,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: &openai.ResponseError{
				StatusCode: 400,
				Message: `{
		                            "error": {
		                              "message": "The requested model 'gpt-4.5-turbo-1106' does not exist.",
		                              "type": "invalid_request_error",
		                              "param": "model",
		                              "code": "model_not_found"
		                            }
		                          }`,
			},
		},
		{
			name: "not found",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-4.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "ass-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-4.5-turbo-1106",
                      "name": "test-assistant",
                      "buckets": ["default"],
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        }
                      ]
                    }`)

				var req api.CreateAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().ModifyAssistantWithResponse(
					gomock.Any(),
					"ass-id",
					JSONComparer(req),
				).Return(
					&api.ModifyAssistantR{
						Body: nil,
						HTTPResponse: &http.Response{
							StatusCode: http.StatusNotFound,
						},
						JSON200: nil,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: openai.ErrNotfound,
		},
		{
			name: "with filestores",
			input: model.GraphiteAssistantInput{
				Name:         "test-assistant",
				Description:  "Test Assistant",
				Instructions: "You are a test assistant",
				Model:        "gpt-3.5-turbo-1106",
				Graphql: []*model.GraphiteAssistantToolGraphQLInput{
					{
						Name:        "GetMoviesWithScoreHigherThan",
						Description: "get movies with higher score than the input",
						Query:       "query GetMoviesWithScoreHigherThan($score: numeric!) {  movies(where: {score: {_gt: $score}}) {    name    overview    score }}",
						Arguments: []*model.GraphiteAssistantToolArgumentInput{
							{
								Name:        "score",
								Description: "score to compare against",
								Type:        "number",
								Required:    true,
							},
						},
					},
				},
				Webhooks: []*model.GraphiteAssistantToolWebhookInput{
					{
						Name:        "test webhook",
						Description: "some description for the webhook",
						URL:         "https://example.com/webhooks/test",
						Arguments:   []*model.GraphiteAssistantToolArgumentInput{},
					},
				},
				FileStores: []string{"filestore-id"},
			},
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "description": "Test Assistant",
                      "instructions": "You are a test assistant",
                      "metadata": {
                        "database-id": "ass-id",
                        "managed-by": "graphite"
                      },
                      "model": "gpt-3.5-turbo-1106",
                      "name": "test-assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "function": {
                            "description": "get movies with higher score than the input",
                            "name": "GetMoviesWithScoreHigherThan",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "function": {
                            "description": "some description for the webhook",
                            "name": "test webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            }
                          },
                          "type": "function"
                        },
                        {
                          "type": "file_search"
                        }
                      ]
                    }`)

				var req api.ModifyAssistantJSONRequestBody
				if err := json.Unmarshal(body, &req); err != nil {
					t.Fatal(err)
				}

				body = []byte(`{
                      "id": "asst_vFOChYBxsWsBn3eFgj2QVFJZ",
                      "object": "assistant",
                      "created_at": 1700580936,
                      "name": "test-assistant",
                      "description": "Test Assistant",
                      "model": "gpt-3.5-turbo-1106",
                      "instructions": "You are a test assistant",
                      "tool_resources": {},
                      "tools": [
                        {
                          "type": "function",
                          "function": {
                            "name": "GetMoviesWithScoreHigherThan",
                            "description": "get movies with higher score than the input",
                            "parameters": {
                              "properties": {
                                "score": {
                                  "description": "score to compare against",
                                  "type": "number"
                                }
                              },
                              "required": [
                                "score"
                              ],
                              "type": "object"
                            },
							"strict": null
                          }
                        },
                        {
                          "type": "function",
                          "function": {
                            "name": "test webhook",
                            "description": "some description for the webhook",
                            "parameters": {
                              "properties": {},
                              "required": [],
                              "type": "object"
                            },
							"strict": null
                          }
                        }
                      ],
                      "file_ids": [],
                      "metadata": {
                        "managed-by": "graphite"
                      }
                    }`)

				var resp api.AssistantObject
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().ModifyAssistantWithResponse(
					gomock.Any(),
					"ass-id",
					JSONComparer(req),
				).Return(
					&api.ModifyAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &resp,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			client := tc.client(ctrl)
			cclient := tc.cclient(ctrl)

			oai := openai.New(
				client,
				cclient,
				"http://graphql:8080/v1/graphql",
				"adminSecret",
				"pgConnStr",
			)

			err := oai.AssistantsUpdate(t.Context(), "ass-id", tc.input)
			if !errors.Is(err, tc.expectedErr) {
				if diff := cmp.Diff(tc.expectedErr, err); diff != "" {
					t.Errorf("unexpected error (-want +got):\n%s", diff)
				}
			}
		})
	}
}

func TestAssistantsDelete(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		client      func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface
		cclient     func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface
		expectedErr error
	}{
		{
			name: "deleted",
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				body := []byte(`{
                      "id": "asst_uO5Bu20yDYf1tg8DZGTGWKpZ",
                      "object": "assistant.deleted",
                      "deleted": true
                    }`)

				var resp api.DeleteAssistantResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatal(err)
				}

				mock.EXPECT().DeleteAssistantWithResponse(
					gomock.Any(),
					"ass-id",
				).Return(
					&api.DeleteAssistantR{
						Body: []byte{},
						HTTPResponse: &http.Response{
							StatusCode: http.StatusOK,
						},
						JSON200: &resp,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: nil,
		},
		{
			name: "not found",
			client: func(ctrl *gomock.Controller) openai.ClientWithResponsesInterface {
				mock := mock.NewMockClientWithResponsesInterface(ctrl)

				mock.EXPECT().DeleteAssistantWithResponse(
					gomock.Any(),
					"ass-id",
				).Return(
					&api.DeleteAssistantR{
						Body: []byte(`{
                              "error": {
                                "message": "No assistant found with id 'asst_uO5Bu20yDYf1tg8DZGTGWKpZ'.",
                                "type": "invalid_request_error",
                                "param": null,
                                "code": null
                              }
                            }`),
						HTTPResponse: &http.Response{
							StatusCode: http.StatusNotFound,
						},
						JSON200: nil,
					},
					nil,
				)

				return mock
			},
			cclient: func(ctrl *gomock.Controller) openai.CustomClientWithResponsesInterface {
				return mock.NewMockCustomClientWithResponsesInterface(ctrl)
			},
			expectedErr: openai.ErrNotfound,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			client := tc.client(ctrl)
			cclient := tc.cclient(ctrl)

			oai := openai.New(
				client,
				cclient,
				"http://graphql:8080/v1/graphql",
				"adminSecret",
				"pgConnStr",
			)

			err := oai.AssistantsDelete(t.Context(), "ass-id")
			if !errors.Is(err, tc.expectedErr) {
				if diff := cmp.Diff(tc.expectedErr, err); diff != "" {
					t.Errorf("unexpected error (-want +got):\n%s", diff)
				}
			}
		})
	}
}
