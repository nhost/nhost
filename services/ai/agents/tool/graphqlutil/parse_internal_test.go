package graphqlutil

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParseSchema(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name     string
		response ResponseIntrospection
		contains []string
	}{
		{
			name: "basic query with scalar fields",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "users",
									Type: Type{
										Kind: KindList,
										OfType: &Type{
											Kind: KindObject,
											Name: new("users"),
										},
									},
								},
							},
						},
						Types: []Type{
							{
								Kind: KindObject,
								Name: new("users"),
								Fields: []Field{
									{
										Name: "id",
										Type: Type{Kind: KindScalar, Name: new("uuid")},
									},
									{
										Name: "name",
										Type: Type{Kind: KindScalar, Name: new("String")},
									},
								},
							},
							{Kind: KindScalar, Name: new("uuid")},
							{Kind: KindScalar, Name: new("String")},
						},
					},
				},
			},
			contains: []string{
				"type users",
				"id: uuid",
				"name: String",
				"type Query",
				"users: [users]",
			},
		},
		{
			name: "no mutation type",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "ping",
									Type: Type{Kind: KindScalar, Name: new("String")},
								},
							},
						},
						MutationType: nil,
						Types: []Type{
							{Kind: KindScalar, Name: new("String")},
						},
					},
				},
			},
			contains: []string{"type Query", "ping: String"},
		},
		{
			name: "with mutations",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "users",
									Type: Type{Kind: KindScalar, Name: new("String")},
								},
							},
						},
						MutationType: &Type{
							Kind: KindObject,
							Name: new("mutation_root"),
							Fields: []Field{
								{
									Name: "insert_users",
									Type: Type{
										Kind: KindObject,
										Name: new("mutation_response"),
									},
								},
							},
						},
						Types: []Type{
							{Kind: KindScalar, Name: new("String")},
							{
								Kind: KindObject,
								Name: new("mutation_response"),
								Fields: []Field{
									{
										Name: "affected_rows",
										Type: Type{Kind: KindScalar, Name: new("Int")},
									},
								},
							},
							{Kind: KindScalar, Name: new("Int")},
						},
					},
				},
			},
			contains: []string{"type Query", "type Mutation", "insert_users"},
		},
		{
			name: "enum type",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "status",
									Type: Type{Kind: KindEnum, Name: new("StatusEnum")},
								},
							},
						},
						Types: []Type{
							{
								Kind: KindEnum,
								Name: new("StatusEnum"),
								EnumValues: []EnumValue{
									{Name: "ACTIVE"},
									{Name: "INACTIVE"},
								},
							},
						},
					},
				},
			},
			contains: []string{
				"enum StatusEnum",
				"ACTIVE",
				"INACTIVE",
				"type Query",
				"status: StatusEnum",
			},
		},
		{
			name: "non-null and list wrappers",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "items",
									Type: Type{
										Kind: KindNonNull,
										OfType: &Type{
											Kind: KindList,
											OfType: &Type{
												Kind: KindNonNull,
												OfType: &Type{
													Kind: KindScalar,
													Name: new("String"),
												},
											},
										},
									},
								},
							},
						},
						Types: []Type{
							{Kind: KindScalar, Name: new("String")},
						},
					},
				},
			},
			contains: []string{"items: [String!]!"},
		},
		{
			name: "input object type",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "users",
									Args: []InputValue{
										{
											Name: "where",
											Type: Type{
												Kind: KindInputObject,
												Name: new("users_bool_exp"),
											},
										},
									},
									Type: Type{Kind: KindScalar, Name: new("String")},
								},
							},
						},
						Types: []Type{
							{Kind: KindScalar, Name: new("String")},
							{
								Kind: KindInputObject,
								Name: new("users_bool_exp"),
								InputFields: []InputValue{
									{
										Name: "id",
										Type: Type{Kind: KindScalar, Name: new("Int")},
									},
								},
							},
							{Kind: KindScalar, Name: new("Int")},
						},
					},
				},
			},
			contains: []string{"input users_bool_exp", "id: Int"},
		},
		{
			name: "union type",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "search",
									Type: Type{Kind: KindUnion, Name: new("SearchResult")},
								},
							},
						},
						Types: []Type{
							{
								Kind: KindUnion,
								Name: new("SearchResult"),
								PossibleTypes: []Type{
									{Kind: KindObject, Name: new("User")},
									{Kind: KindObject, Name: new("Post")},
								},
							},
							{
								Kind: KindObject,
								Name: new("User"),
								Fields: []Field{
									{Name: "id", Type: Type{Kind: KindScalar, Name: new("ID")}},
								},
							},
							{
								Kind: KindObject,
								Name: new("Post"),
								Fields: []Field{
									{
										Name: "title",
										Type: Type{Kind: KindScalar, Name: new("String")},
									},
								},
							},
							{Kind: KindScalar, Name: new("ID")},
							{Kind: KindScalar, Name: new("String")},
						},
					},
				},
			},
			contains: []string{"union SearchResult = User | Post"},
		},
		{
			name: "type with interface",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "node",
									Type: Type{Kind: KindInterface, Name: new("Node")},
								},
							},
						},
						Types: []Type{
							{
								Kind: KindInterface,
								Name: new("Node"),
								Fields: []Field{
									{Name: "id", Type: Type{Kind: KindScalar, Name: new("ID")}},
								},
								PossibleTypes: []Type{
									{Kind: KindObject, Name: new("User")},
								},
							},
							{
								Kind: KindObject,
								Name: new("User"),
								Fields: []Field{
									{Name: "id", Type: Type{Kind: KindScalar, Name: new("ID")}},
								},
								Interfaces: []Type{
									{Kind: KindInterface, Name: new("Node")},
								},
							},
							{Kind: KindScalar, Name: new("ID")},
						},
					},
				},
			},
			contains: []string{"interface Node", "type User implements Node"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result := ParseSchema(tc.response)
			for _, s := range tc.contains {
				if !strings.Contains(result, s) {
					t.Errorf("expected output to contain %q, got:\n%s", s, result)
				}
			}
		})
	}
}

func TestParseSchemaNoMutationBlock(t *testing.T) {
	t.Parallel()

	response := ResponseIntrospection{
		Data: IntrospectionResponse{
			Schema: Schema{
				QueryType: Type{
					Kind: KindObject,
					Name: new("query_root"),
					Fields: []Field{
						{Name: "ping", Type: Type{Kind: KindScalar, Name: new("String")}},
					},
				},
				MutationType: nil,
				Types:        []Type{{Kind: KindScalar, Name: new("String")}},
			},
		},
	}

	result := ParseSchema(response)
	if strings.Contains(result, "type Mutation") {
		t.Errorf("expected no Mutation block when mutationType is nil, got:\n%s", result)
	}
}

func TestSummarizeSchema(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		response ResponseIntrospection
		want     map[string][]string
	}{
		{
			name: "queries and mutations",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{Name: "users", Type: Type{Kind: KindScalar, Name: new("String")}},
								{Name: "posts", Type: Type{Kind: KindScalar, Name: new("String")}},
							},
						},
						MutationType: &Type{
							Kind: KindObject,
							Name: new("mutation_root"),
							Fields: []Field{
								{
									Name: "insert_users",
									Type: Type{Kind: KindScalar, Name: new("String")},
								},
							},
						},
					},
				},
			},
			want: map[string][]string{
				"query":    {"users", "posts"},
				"mutation": {"insert_users"},
			},
		},
		{
			name: "queries only",
			response: ResponseIntrospection{
				Data: IntrospectionResponse{
					Schema: Schema{
						QueryType: Type{
							Kind: KindObject,
							Name: new("query_root"),
							Fields: []Field{
								{
									Name: "health",
									Type: Type{Kind: KindScalar, Name: new("Boolean")},
								},
							},
						},
						MutationType: nil,
					},
				},
			},
			want: map[string][]string{
				"query": {"health"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result := SummarizeSchema(tc.response)

			var got map[string][]string
			if err := json.Unmarshal([]byte(result), &got); err != nil {
				t.Fatalf("expected valid JSON, got error: %v\nraw: %s", err, result)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSummarizeSchemaNoMutationKey(t *testing.T) {
	t.Parallel()

	response := ResponseIntrospection{
		Data: IntrospectionResponse{
			Schema: Schema{
				QueryType: Type{
					Kind: KindObject,
					Name: new("query_root"),
					Fields: []Field{
						{Name: "ping", Type: Type{Kind: KindScalar, Name: new("String")}},
					},
				},
				MutationType: nil,
			},
		},
	}

	result := SummarizeSchema(response)

	var got map[string][]string
	if err := json.Unmarshal([]byte(result), &got); err != nil {
		t.Fatalf("expected valid JSON, got error: %v", err)
	}

	if _, ok := got["mutation"]; ok {
		t.Error("expected no 'mutation' key when mutationType is nil")
	}
}

func TestGetTypeName(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		typ  Type
		want string
	}{
		{
			name: "simple scalar",
			typ:  Type{Kind: KindScalar, Name: new("String")},
			want: "String",
		},
		{
			name: "non-null scalar",
			typ: Type{
				Kind:   KindNonNull,
				OfType: &Type{Kind: KindScalar, Name: new("Int")},
			},
			want: "Int!",
		},
		{
			name: "list of scalars",
			typ: Type{
				Kind:   KindList,
				OfType: &Type{Kind: KindScalar, Name: new("String")},
			},
			want: "[String]",
		},
		{
			name: "non-null list of non-null",
			typ: Type{
				Kind: KindNonNull,
				OfType: &Type{
					Kind: KindList,
					OfType: &Type{
						Kind:   KindNonNull,
						OfType: &Type{Kind: KindScalar, Name: new("ID")},
					},
				},
			},
			want: "[ID!]!",
		},
		{
			name: "non-null with nil ofType",
			typ:  Type{Kind: KindNonNull, OfType: nil},
			want: "Unknown!",
		},
		{
			name: "list with nil ofType",
			typ:  Type{Kind: KindList, OfType: nil},
			want: "[Unknown]",
		},
		{
			name: "type with nil name",
			typ:  Type{Kind: KindObject, Name: nil},
			want: "Unknown",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := getTypeName(tc.typ)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
