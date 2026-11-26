package queries_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
)

// The role and field assertions are taken from the checked-in Phase 2
// contract, not from a live Hasura instance.
//
//nolint:cyclop,gocognit // Verifies the checked-in Phase 2 role, field and input-type contract.
func TestComputedScalarRoleSchema(
	t *testing.T,
) {
	t.Parallel()
	//nolint:dogsled // The fixture returns roots, pool, objects, metadata and grouped ops; each test selects its needed values.
	_, _, objects, md, _ := computedTestFixture(t)

	raw, err := os.ReadFile(computedFixtureDir + "computedfields/testdata/contract.json")
	if err != nil {
		t.Fatal(err)
	}

	var contract struct {
		Roles []struct {
			Role   string `json:"role"`
			Fields map[string]struct {
				Type string            `json:"type"`
				Args map[string]string `json:"args"`
			} `json:"object_fields"`
			ArgsTypes map[string]map[string]string `json:"args_types"`
		} `json:"roles"`
	}
	if err := json.Unmarshal(raw, &contract); err != nil {
		t.Fatal(err)
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	names := []string{"item_label", "item_payload", "item_score", "item_second"}
	for _, role := range contract.Roles {
		t.Run(role.Role, func(t *testing.T) {
			t.Parallel()

			generated, err := schema.GenerateForRole(objects, role.Role, md, caps)
			if err != nil {
				t.Fatal(err)
			}

			doc := generated.ToAST()

			item := doc.Definitions.ForName("cf_select_items")
			if item == nil {
				t.Fatal("missing table object")
			}

			for _, name := range names {
				expected, granted := role.Fields[name]

				field := item.Fields.ForName(name)
				if !granted {
					if field != nil {
						t.Fatalf("denied field %s leaked", name)
					}

					continue
				}

				if field == nil || field.Type.String() != expected.Type {
					t.Fatalf("field %s type = %v, want %s", name, field, expected.Type)
				}

				if description := "A computed field, executes function \"cf_select." + name + "\""; field.Description != description {
					t.Fatalf(
						"field %s description = %q, want %q",
						name,
						field.Description,
						description,
					)
				}

				if name == "item_payload" &&
					field.Arguments.ForName("path").Description != "JSON select path" {
					t.Fatalf("path description = %q", field.Arguments.ForName("path").Description)
				}

				if len(field.Arguments) != len(expected.Args) {
					t.Fatalf("field %s args = %v, want %v", name, field.Arguments, expected.Args)
				}

				for argName, typ := range expected.Args {
					arg := field.Arguments.ForName(argName)
					if arg == nil || arg.Type.String() != typ {
						t.Fatalf("field %s arg %s = %v, want %s", name, argName, arg, typ)
					}

					if argName == "args" {
						want := "input parameters for computed field \"" + name +
							"\" defined on table \"cf_select.items\""
						if arg.Description != want {
							t.Fatalf("args description = %q, want %q", arg.Description, want)
						}
					}
				}
			}

			for _, name := range []string{"item_score_cf_select_items_args", "item_second_cf_select_items_args"} {
				def := doc.Definitions.ForName(name)
				if _, granted := role.ArgsTypes[name]; !granted {
					if def != nil {
						t.Fatalf("denied _args type %s leaked", name)
					}

					continue
				}

				if def == nil {
					t.Fatalf("missing _args type %s", name)
				}

				for argName, typ := range role.ArgsTypes[name] {
					arg := def.Fields.ForName(argName)
					if arg == nil || arg.Type.String() != typ {
						t.Fatalf("_args %s.%s = %v, want %s", name, argName, arg, typ)
					}
				}
			}
		})
	}
}
