package action

import (
	"bytes"
	"context"
	"flag"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

var update = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

func TestGetSchemaRoleReachability(t *testing.T) {
	t.Parallel()

	collector := metadata.NewInconsistencies()
	conn := newConnector(t.Context(), roleReachabilityMetadata(), collector)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	if snapshot := collector.Snapshot(); len(snapshot) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", snapshot)
	}

	for _, role := range []string{metadata.RoleAdmin, "public", "user"} {
		t.Run(role, func(t *testing.T) {
			t.Parallel()

			schema, ok := schemas[role]
			if !ok {
				t.Fatalf("schema for role %q not found", role)
			}

			sdl := schemaSDL(t, role, schema)
			testhelpers.GoldenGraphQLSchema(
				t,
				"testdata/"+t.Name()+".graphqls",
				sdl,
				*update,
			)
		})
	}

	if got := conn.GetTypeName("searchCatalog"); got != "SearchResult" {
		t.Fatalf("GetTypeName(searchCatalog) = %q, want SearchResult", got)
	}

	if err := conn.ValidateOperation(nil, nil, nil, "user", nil); err != nil {
		t.Fatalf("ValidateOperation returned error: %v", err)
	}
}

func TestGetSchemaRoleConflictFiltering(t *testing.T) {
	t.Parallel()

	collector := metadata.NewInconsistencies()
	conn := newConnector(
		t.Context(),
		conflictFilteringMetadata(),
		collector,
		withOccupiedRootFields(map[string]map[string]struct{}{
			"user": {schemamerge.FieldKey(ast.Query, "taken"): {}},
		}),
		withOccupiedTypeNames(map[string]map[string]struct{}{
			"public": {"ExistingOutput": {}},
		}),
	)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	assertRootFields(t, schemas[metadata.RoleAdmin], []string{
		"safe", "taken", "typeConflict",
	})
	assertRootFields(t, schemas["user"], []string{
		"safe", "typeConflict",
	})
	assertRootFields(t, schemas["public"], []string{
		"safe", "taken",
	})

	snapshot := collector.Snapshot()
	assertInconsistency(
		t, snapshot, metadata.InconsistencyKindAction,
		"taken", "root field \"taken\" conflicts for role \"user\"",
	)
	assertInconsistency(
		t, snapshot, metadata.InconsistencyKindCustomType,
		"ExistingOutput", "conflicts for role \"public\"",
	)
	assertInconsistency(
		t, snapshot, metadata.InconsistencyKindAction,
		"typeConflict", "custom type \"ExistingOutput\" conflicts for role \"public\"",
	)
}

func TestGetSchemaAllowsValidCustomObjectRelationships(t *testing.T) {
	t.Parallel()

	collector := metadata.NewInconsistencies()
	conn := newConnector(
		t.Context(),
		testMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"relationshipAction",
					metadata.ActionOperationQuery,
					"RelOutput!",
					nil,
					nil,
				),
			},
			customTypes(withObjects(objectType(
				"RelOutput",
				[]metadata.CustomObjectRelationship{objectRelationship("owner")},
				objectField("ownerID", "ID!"),
			))),
		),
		collector,
		withRelationshipTargets(
			relationshipTargets("default", "public", "users", map[string][]string{
				metadata.RoleAdmin: {"id", "displayName"},
			}),
		),
	)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	assertRootFields(t, schemas[metadata.RoleAdmin], []string{"relationshipAction"})

	if snapshot := collector.Snapshot(); len(snapshot) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", snapshot)
	}
}

// TestAsyncResponseOutputFieldIsNullable asserts the async result object type's
// `output` field is nullable even when the action declares a non-null output
// type. A pending async log has no payload (output:null), so a non-null field
// would be a GraphQL contract violation and diverge from Hasura.
func TestAsyncResponseOutputFieldIsNullable(t *testing.T) {
	t.Parallel()

	collector := metadata.NewInconsistencies()
	conn := newConnector(
		t.Context(),
		testMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"echoAsync",
					metadata.ActionOperationMutation,
					"AsyncOut!", // declared NON-NULL output type
					[]string{"user"},
					[]metadata.ActionArgument{actionArg("message", "String!", "")},
					withActionKind(metadata.ActionKindAsynchronous),
				),
			},
			customTypes(
				withObjects(objectType("AsyncOut", nil, objectField("message", "String!"))),
			),
		),
		collector,
		WithAsyncConfig(AsyncConfig{Store: noopActionLogStore{}}),
	)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	if snap := collector.Snapshot(); len(snap) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", snap)
	}

	schema := schemas[metadata.RoleAdmin]
	if schema == nil {
		t.Fatal("admin schema missing")
	}

	// The async result object type is named after the action.
	output := actionFieldType(t, schema, "echoAsync", "output")
	if output == nil {
		t.Fatal("output field not found on async result type")
	}

	if output.NonNull {
		t.Errorf(
			"async result output field is non-null; want nullable for declared %q",
			"AsyncOut!",
		)
	}

	if output.NamedType != "AsyncOut" {
		t.Errorf("async result output named type = %q, want AsyncOut", output.NamedType)
	}

	// The whole schema must still validate (a pending log returns output:null).
	if _, _, err := schemamerge.BuildValidatedSchema(schema, metadata.RoleAdmin); err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}
}

// noopActionLogStore is an inert ActionLogStore that makes async actions
// available during schema-building tests (the builder records an inconsistency
// for async actions when no store is configured). With WorkerEnabled unset, no
// background worker is started.
type noopActionLogStore struct{}

func (noopActionLogStore) Insert(context.Context, ActionLogInsert) (ActionLogEntry, error) {
	return ActionLogEntry{}, nil
}

func (noopActionLogStore) ClaimPending(context.Context, int) ([]ActionLogEntry, error) {
	return nil, nil
}

func (noopActionLogStore) Complete(context.Context, uuid.UUID, []byte) error { return nil }
func (noopActionLogStore) Fail(context.Context, uuid.UUID, []byte) error     { return nil }

func (noopActionLogStore) Get(context.Context, uuid.UUID) (ActionLogEntry, bool, error) {
	return ActionLogEntry{}, false, nil
}

func (noopActionLogStore) RequeueProcessing(context.Context, []uuid.UUID) error { return nil }
func (noopActionLogStore) Close()                                               {}

func actionFieldType(t *testing.T, schema *graph.Schema, typeName, fieldName string) *graph.Type {
	t.Helper()

	for _, obj := range schema.Types {
		if obj.Name != typeName {
			continue
		}

		for _, f := range obj.Fields {
			if f.Name == fieldName {
				return f.Type
			}
		}
	}

	return nil
}

// TestAsyncActionNameCollisionWithCustomTypeDropsAction asserts that when an
// asynchronous action's name equals a custom object type's name (both would
// emit an object type of the same name into one role schema), only the async
// action is dropped — with an inconsistency — and the connector still produces
// valid per-role schemas instead of having the duplicate type sink the whole
// connector.
func TestAsyncActionNameCollisionWithCustomTypeDropsAction(t *testing.T) {
	t.Parallel()

	collector := metadata.NewInconsistencies()
	conn := newConnector(
		t.Context(),
		testMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"Dup",
					metadata.ActionOperationMutation,
					"Dup!",
					[]string{"user"},
					[]metadata.ActionArgument{actionArg("x", "String!", "")},
					withActionKind(metadata.ActionKindAsynchronous),
				),
				actionMeta("ok", metadata.ActionOperationQuery, "OkOut!", []string{"user"}, nil),
			},
			customTypes(withObjects(
				objectType("Dup", nil, objectField("y", "String!")),
				objectType("OkOut", nil, objectField("ok", "String!")),
			)),
		),
		collector,
		WithAsyncConfig(AsyncConfig{Store: noopActionLogStore{}}),
	)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	for _, role := range []string{metadata.RoleAdmin, "user"} {
		schema := schemas[role]
		if schema == nil {
			t.Fatalf("schema for role %q missing", role)
		}

		if _, _, err := schemamerge.BuildValidatedSchema(schema, role); err != nil {
			t.Fatalf("BuildValidatedSchema for role %q: %v", role, err)
		}
	}

	assertRootFields(t, schemas[metadata.RoleAdmin], []string{"ok"})

	assertInconsistency(
		t, collector.Snapshot(), metadata.InconsistencyKindAction,
		"Dup", "conflicts with a custom type",
	)
}

// TestAsyncActionNameCollisionWithReservedTypeDropsAction verifies that an
// async action whose name collides with a reserved root type, a builtin scalar,
// or an async-generated scalar is dropped with a recorded inconsistency and the
// remaining per-role schemas still validate — instead of emitting a duplicate
// type that fails BuildValidatedSchema and silently drops the whole role.
func TestAsyncActionNameCollisionWithReservedTypeDropsAction(t *testing.T) {
	t.Parallel()

	for _, name := range []string{"Query", "Mutation", "String", "uuid", "timestamptz", "json"} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			collector := metadata.NewInconsistencies()
			conn := newConnector(
				t.Context(),
				testMetadata(
					[]metadata.ActionMetadata{
						actionMeta(
							name,
							metadata.ActionOperationMutation,
							"ReservedOut!",
							[]string{"user"},
							[]metadata.ActionArgument{actionArg("x", "String!", "")},
							withActionKind(metadata.ActionKindAsynchronous),
						),
						actionMeta(
							"ok",
							metadata.ActionOperationQuery,
							"OkOut!",
							[]string{"user"},
							nil,
						),
					},
					customTypes(withObjects(
						objectType("ReservedOut", nil, objectField("y", "String!")),
						objectType("OkOut", nil, objectField("ok", "String!")),
					)),
				),
				collector,
				WithAsyncConfig(AsyncConfig{Store: noopActionLogStore{}}),
			)

			schemas, err := conn.GetSchema()
			if err != nil {
				t.Fatalf("GetSchema: %v", err)
			}

			for _, role := range []string{metadata.RoleAdmin, "user"} {
				schema := schemas[role]
				if schema == nil {
					t.Fatalf("schema for role %q missing", role)
				}

				if _, _, err := schemamerge.BuildValidatedSchema(schema, role); err != nil {
					t.Fatalf("BuildValidatedSchema for role %q: %v", role, err)
				}
			}

			assertRootFields(t, schemas[metadata.RoleAdmin], []string{"ok"})

			assertInconsistency(
				t, collector.Snapshot(), metadata.InconsistencyKindAction,
				name, "conflicts with a reserved or generated type name",
			)
		})
	}
}

//nolint:maintidx // broad table covers fine-grained filtering matrix.
func TestSchemaConflictFiltering(
	t *testing.T,
) {
	t.Parallel()

	tests := []struct {
		name       string
		meta       *metadata.Metadata
		wantFields []string
		wantInc    []wantInconsistency
	}{
		{
			name: "duplicate action definitions",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta("dup", metadata.ActionOperationQuery, "DupOutput!", nil, nil),
					actionMeta("dup", metadata.ActionOperationQuery, "DupOutput!", nil, nil),
				},
				customTypes(
					withObjects(
						objectType("OkOutput", nil, objectField("ok", "String!")),
						objectType("DupOutput", nil, objectField("value", "String!")),
					),
				),
			),
			wantFields: []string{"ok"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindAction,
					name: "dup",
					sub:  "duplicate action definition",
				},
			},
		},
		{
			name: "invalid action type references",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta(
						"badInput",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						[]metadata.ActionArgument{actionArg("input", "MissingInput!", "")},
					),
					actionMeta(
						"badOutput",
						metadata.ActionOperationQuery,
						"MissingOutput!",
						nil,
						nil,
					),
				},
				customTypes(withObjects(objectType("OkOutput", nil, objectField("ok", "String!")))),
			),
			wantFields: []string{"ok"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindAction,
					name: "badInput",
					sub:  "unknown type \"MissingInput\"",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "badOutput",
					sub:  "unknown type \"MissingOutput\"",
				},
			},
		},
		{
			name: "duplicate custom type name",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta(
						"usesDuplicate",
						metadata.ActionOperationQuery,
						"DuplicateOutput!",
						nil,
						nil,
					),
				},
				customTypes(
					withObjects(
						objectType("OkOutput", nil, objectField("ok", "String!")),
						objectType("DuplicateOutput", nil, objectField("a", "String!")),
						objectType("DuplicateOutput", nil, objectField("b", "String!")),
					),
				),
			),
			wantFields: []string{"ok"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindCustomType,
					name: "DuplicateOutput",
					sub:  "duplicate custom type name",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "usesDuplicate",
					sub:  "references invalid custom type \"DuplicateOutput\"",
				},
			},
		},
		{
			name: "input custom type cycle",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta(
						"cyclic",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						[]metadata.ActionArgument{actionArg("input", "NodeInput", "")},
					),
				},
				customTypes(
					withInputs(metadata.CustomInputObjectType{
						Name:        "NodeInput",
						Description: "",
						Fields: []metadata.CustomTypeField{
							customField("child", "NodeInput", ""),
						},
					}),
					withObjects(objectType("OkOutput", nil, objectField("ok", "String!"))),
				),
			),
			wantFields: []string{"ok"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindCustomType,
					name: "NodeInput",
					sub:  "custom type cycle detected",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "cyclic",
					sub:  "references invalid custom type \"NodeInput\"",
				},
			},
		},
		{
			name: "nullable output custom type cycle",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta("cyclic", metadata.ActionOperationQuery, "Node!", nil, nil),
				},
				customTypes(
					withObjects(
						objectType("OkOutput", nil, objectField("ok", "String!")),
						objectType("Node", nil, objectField("child", "Node")),
					),
				),
			),
			wantFields: []string{"cyclic", "ok"},
			wantInc:    nil,
		},
		{
			name: "invalid runtime metadata",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta(
						"badURL",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withActionHandler("ftp://actions.example.test/bad"),
					),
					actionMeta(
						"missingHandlerEnv",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withActionHandler("{{__NHOST_ACTION_TEST_MISSING_HANDLER__}}/bad"),
					),
					actionMeta(
						"missingHeaderEnv",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withActionHeaders(metadata.ActionHeader{
							Name:         "x-test-secret",
							Value:        "",
							ValueFromEnv: "__NHOST_ACTION_TEST_MISSING_HEADER__",
						}),
					),
					actionMeta(
						"badTimeout",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withActionTimeout(-1),
					),
				},
				customTypes(withObjects(objectType("OkOutput", nil, objectField("ok", "String!")))),
			),
			wantFields: []string{"ok"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindAction,
					name: "badURL",
					sub:  "invalid handler URL",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "missingHandlerEnv",
					sub:  "resolving handler URL",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "missingHeaderEnv",
					sub:  "building headers",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "badTimeout",
					sub:  "invalid timeout -1",
				},
			},
		},
		{
			name: "unsupported deferred features",
			meta: testMetadata(
				[]metadata.ActionMetadata{
					actionMeta("ok", metadata.ActionOperationQuery, "OkOutput!", nil, nil),
					actionMeta(
						"asyncAction",
						metadata.ActionOperationMutation,
						"OkOutput!",
						nil,
						nil,
						withActionKind(metadata.ActionKindAsynchronous),
					),
					actionMeta(
						"transformAction",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withRequestTransform(map[string]any{"body": "{{$body}}"}),
					),
					actionMeta(
						"invalidTransform",
						metadata.ActionOperationQuery,
						"OkOutput!",
						nil,
						nil,
						withRequestTransform(map[string]any{"template_engine": "GoTemplate"}),
					),
					actionMeta(
						"relationshipAction",
						metadata.ActionOperationQuery,
						"RelOutput!",
						nil,
						nil,
					),
				},
				customTypes(
					withObjects(
						objectType("OkOutput", nil, objectField("ok", "String!")),
						objectType(
							"RelOutput",
							[]metadata.CustomObjectRelationship{objectRelationship("owner")},
							objectField("ownerID", "ID!"),
						),
					),
				),
			),
			wantFields: []string{"ok", "transformAction"},
			wantInc: []wantInconsistency{
				{
					kind: metadata.InconsistencyKindAction,
					name: "asyncAction",
					sub:  "asynchronous action log store is not configured",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "invalidTransform",
					sub:  "invalid request transform",
				},
				{
					kind: metadata.InconsistencyKindCustomType,
					name: "RelOutput",
					sub:  "relationship \"owner\" target source/table \"public\".\"users\" not found",
				},
				{
					kind: metadata.InconsistencyKindAction,
					name: "relationshipAction",
					sub:  "references invalid custom type \"RelOutput\"",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			collector := metadata.NewInconsistencies()
			conn := newConnector(t.Context(), tt.meta, collector)

			schemas, err := conn.GetSchema()
			if err != nil {
				t.Fatalf("GetSchema: %v", err)
			}

			assertRootFields(t, schemas[metadata.RoleAdmin], tt.wantFields)

			snapshot := collector.Snapshot()
			for _, want := range tt.wantInc {
				assertInconsistency(t, snapshot, want.kind, want.name, want.sub)
			}
		})
	}
}

type wantInconsistency struct {
	kind string
	name string
	sub  string
}

func schemaSDL(t *testing.T, role string, schema *graph.Schema) string {
	t.Helper()

	if _, _, err := schemamerge.BuildValidatedSchema(schema, role); err != nil {
		t.Fatalf("validating schema for role %q: %v", role, err)
	}

	var buf bytes.Buffer
	formatter.NewFormatter(&buf, formatter.WithIndent("  ")).FormatSchemaDocument(schema.ToAST())

	return buf.String()
}

func assertRootFields(t *testing.T, schema *graph.Schema, want []string) {
	t.Helper()

	if schema == nil {
		t.Fatalf("schema is nil, want root fields %v", want)
	}

	got := rootFields(schema, queryRootTypeName)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("root fields mismatch (-want +got):\n%s", diff)
	}
}

func rootFields(schema *graph.Schema, rootTypeName string) []string {
	for _, object := range schema.Types {
		if object.Name != rootTypeName {
			continue
		}

		fields := make([]string, 0, len(object.Fields))
		for _, field := range object.Fields {
			fields = append(fields, field.Name)
		}

		slices.Sort(fields)

		return fields
	}

	return nil
}

func assertInconsistency(
	t *testing.T,
	items []metadata.Inconsistency,
	wantKind, wantName, wantReasonSubstr string,
) {
	t.Helper()

	for _, item := range items {
		if item.Kind != wantKind || item.Name != wantName {
			continue
		}

		if !strings.Contains(item.Reason, wantReasonSubstr) {
			t.Fatalf(
				"inconsistency %s/%s reason = %q, want substring %q",
				wantKind,
				wantName,
				item.Reason,
				wantReasonSubstr,
			)
		}

		if item.At.IsZero() {
			t.Fatalf("inconsistency %s/%s has zero timestamp", wantKind, wantName)
		}

		return
	}

	t.Fatalf("missing inconsistency %s/%s in %+v", wantKind, wantName, items)
}

func roleReachabilityMetadata() *metadata.Metadata {
	return testMetadata(
		[]metadata.ActionMetadata{
			actionMeta(
				"adminReindex",
				metadata.ActionOperationMutation,
				"ActionStatus!",
				nil,
				nil,
				withActionComment("Admin-only maintenance action."),
			),
			actionMeta(
				"searchCatalog",
				metadata.ActionOperationQuery,
				"[SearchResult!]!",
				[]string{"public", "user"},
				[]metadata.ActionArgument{
					actionArg("filter", "SearchFilter!", "Search constraints."),
				},
				withActionComment("Searches the public catalog."),
			),
			actionMeta(
				"userStats",
				metadata.ActionOperationQuery,
				"UserStats!",
				[]string{"user"},
				nil,
				withActionComment("Returns private user statistics."),
			),
		},
		customTypes(
			withScalars(metadata.CustomScalarType{
				Name:        "DateTime",
				Description: "ISO-8601 timestamp.",
			}),
			withEnums(metadata.CustomEnumType{
				Name:        "ActionStatus",
				Description: "Action lifecycle state.",
				Values: []metadata.CustomEnumValue{
					{
						Value:             "OK",
						Description:       "The action completed.",
						IsDeprecated:      false,
						DeprecationReason: "",
					},
					{
						Value:             "OLD",
						Description:       "Legacy state.",
						IsDeprecated:      true,
						DeprecationReason: "Use OK instead.",
					},
				},
			}),
			withInputs(metadata.CustomInputObjectType{
				Name:        "SearchFilter",
				Description: "Search filter input.",
				Fields: []metadata.CustomTypeField{
					customField("term", "String!", "Free-text search term."),
					customField("since", "DateTime", "Lower creation bound."),
					customField("status", "ActionStatus", "Status filter."),
				},
			}),
			withObjects(
				metadata.CustomObjectType{
					Name:        "SearchResult",
					Description: "One search hit.",
					Fields: []metadata.CustomTypeField{
						customField("id", "ID!", "Stable identifier."),
						customField("title", "String!", "Display title."),
						customField("status", "ActionStatus!", "Current status."),
						customField("createdAt", "DateTime!", "Creation time."),
					},
					Relationships: nil,
				},
				objectType("UserStats", nil, objectField("loginCount", "Int!")),
			),
		),
	)
}

func conflictFilteringMetadata() *metadata.Metadata {
	return testMetadata(
		[]metadata.ActionMetadata{
			actionMeta(
				"safe",
				metadata.ActionOperationQuery,
				"SafeOutput!",
				[]string{"public", "user"},
				nil,
			),
			actionMeta(
				"taken",
				metadata.ActionOperationQuery,
				"TakenOutput!",
				[]string{"public", "user"},
				nil,
			),
			actionMeta(
				"typeConflict",
				metadata.ActionOperationQuery,
				"ExistingOutput!",
				[]string{"public", "user"},
				nil,
			),
		},
		customTypes(
			withObjects(
				objectType("SafeOutput", nil, objectField("ok", "String!")),
				objectType("TakenOutput", nil, objectField("ok", "String!")),
				objectType("ExistingOutput", nil, objectField("ok", "String!")),
			),
		),
	)
}

func testMetadata(
	actions []metadata.ActionMetadata,
	customTypes metadata.CustomTypes,
) *metadata.Metadata {
	return &metadata.Metadata{
		Databases:       nil,
		RemoteSchemas:   nil,
		Actions:         actions,
		CustomTypes:     customTypes,
		LoadDiagnostics: nil,
	}
}

type actionOption func(*metadata.ActionMetadata)

func actionMeta(
	name string,
	operation string,
	outputType string,
	roles []string,
	arguments []metadata.ActionArgument,
	opts ...actionOption,
) metadata.ActionMetadata {
	permissions := make([]metadata.ActionPermission, 0, len(roles))
	for _, role := range roles {
		permissions = append(permissions, metadata.ActionPermission{Role: role})
	}

	action := metadata.ActionMetadata{
		Name: name,
		Definition: metadata.ActionDefinition{
			Kind:                 metadata.ActionKindSynchronous,
			Handler:              metadata.EnvString("https://actions.example.test/" + name),
			ForwardClientHeaders: false,
			Headers:              nil,
			Timeout:              30,
			Type:                 operation,
			Arguments:            arguments,
			OutputType:           outputType,
			RequestTransform:     nil,
			ResponseTransform:    nil,
		},
		Permissions: permissions,
		Comment:     "",
	}

	for _, opt := range opts {
		opt(&action)
	}

	return action
}

func withActionKind(kind string) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.Kind = kind
	}
}

func withActionComment(comment string) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Comment = comment
	}
}

func withActionHandler(handler metadata.EnvString) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.Handler = handler
	}
}

func withActionTimeout(timeout int) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.Timeout = timeout
	}
}

func withRequestTransform(transform map[string]any) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.RequestTransform = transform
	}
}

func withResponseTransform(transform map[string]any) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.ResponseTransform = transform
	}
}

func actionArg(name, typ, description string) metadata.ActionArgument {
	return metadata.ActionArgument{
		Name:        name,
		Type:        typ,
		Description: description,
	}
}

type customTypesOption func(*metadata.CustomTypes)

func customTypes(opts ...customTypesOption) metadata.CustomTypes {
	customTypes := metadata.CustomTypes{
		InputObjects: nil,
		Objects:      nil,
		Scalars:      nil,
		Enums:        nil,
	}

	for _, opt := range opts {
		opt(&customTypes)
	}

	return customTypes
}

func withScalars(scalars ...metadata.CustomScalarType) customTypesOption {
	return func(customTypes *metadata.CustomTypes) {
		customTypes.Scalars = scalars
	}
}

func withEnums(enums ...metadata.CustomEnumType) customTypesOption {
	return func(customTypes *metadata.CustomTypes) {
		customTypes.Enums = enums
	}
}

func withInputs(inputs ...metadata.CustomInputObjectType) customTypesOption {
	return func(customTypes *metadata.CustomTypes) {
		customTypes.InputObjects = inputs
	}
}

func withObjects(objects ...metadata.CustomObjectType) customTypesOption {
	return func(customTypes *metadata.CustomTypes) {
		customTypes.Objects = objects
	}
}

func objectType(
	name string,
	relationships []metadata.CustomObjectRelationship,
	fields ...metadata.CustomTypeField,
) metadata.CustomObjectType {
	return metadata.CustomObjectType{
		Name:          name,
		Description:   "",
		Fields:        fields,
		Relationships: relationships,
	}
}

func objectField(name, typ string) metadata.CustomTypeField {
	return customField(name, typ, "")
}

func customField(name, typ, description string) metadata.CustomTypeField {
	return metadata.CustomTypeField{
		Name:        name,
		Type:        typ,
		Description: description,
	}
}

func objectRelationship(name string) metadata.CustomObjectRelationship {
	return metadata.CustomObjectRelationship{
		Name: name,
		Type: "object",
		RemoteTable: metadata.TableSource{
			Name:   "users",
			Schema: "public",
		},
		FieldMapping: map[string]string{"ownerID": "id"},
		Source:       "default",
	}
}

func relationshipTargets(
	source string,
	schema string,
	table string,
	roleFields map[string][]string,
) RelationshipTargets {
	roles := make(map[string]RelationshipTargetRole, len(roleFields))
	for role, fields := range roleFields {
		fieldSet := make(map[string]struct{}, len(fields))
		for _, field := range fields {
			fieldSet[field] = struct{}{}
		}

		roles[role] = RelationshipTargetRole{Fields: fieldSet}
	}

	return RelationshipTargets{
		{
			Source: source,
			Schema: schema,
			Table:  table,
		}: {Roles: roles},
	}
}
