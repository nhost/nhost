package sql_test

import (
	"encoding/json"
	"errors"
	"log/slog"
	"reflect"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop,gocognit // Independent checked-in contract cases include both data and error paths.
func TestComputedScalarPhase2ConnectorCases(t *testing.T) {
	t.Parallel()

	var contract struct {
		Cases []struct {
			Name     string `json:"name"`
			Role     string `json:"role"`
			Query    string `json:"query"`
			Response struct {
				Data map[string]any `json:"data"`
			} `json:"response"`
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	fixtureDB := computedTestDB(t)

	pgPool, err := postgres.Open(t.Context(), fixtureDB.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}

	driver := postgres.NewClient(pgPool)
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	connector, err := csql.NewConnector(
		t.Context(),
		driver,
		&md.Databases[0],
		nil,
		slog.Default(),
		caps,
	)
	if err != nil {
		driver.Close()
		t.Fatal(err)
	}

	t.Cleanup(connector.Close)

	names := map[string]bool{
		"second-row-argument":       true,
		"default-argument":          true,
		"jsonb-path":                true,
		"required-argument-omitted": true,
	}

	seen := make(map[string]bool, len(names))
	for _, tc := range contract.Cases {
		if !names[tc.Name] {
			continue
		}

		if seen[tc.Name] {
			t.Fatalf("duplicate contract case %q", tc.Name)
		}

		seen[tc.Name] = true

		t.Run(tc.Name, func(t *testing.T) {
			t.Parallel()

			doc, err := parser.ParseQuery(&ast.Source{Input: tc.Query})
			if err != nil {
				t.Fatal(err)
			}

			result, err := connector.Execute(
				t.Context(),
				doc.Operations[0],
				doc.Fragments,
				nil,
				tc.Role,
				nil,
				slog.Default(),
			)
			if tc.Error.Code != "" {
				var omitted *arguments.ComputedOmissionError
				if !errors.As(err, &omitted) {
					t.Fatalf("expected computed omission, got %v", err)
				}

				envelope := omitted.AsMap()

				extensions, valid := envelope["extensions"].(map[string]any)
				if !valid || envelope["message"] != tc.Error.Message ||
					extensions["code"] != tc.Error.Code {
					t.Fatalf("expected %s: %s, got %#v", tc.Error.Code, tc.Error.Message, envelope)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			actualBytes, err := json.Marshal(result)
			if err != nil {
				t.Fatal(err)
			}

			var actual map[string]any
			if err := json.Unmarshal(actualBytes, &actual); err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(actual, tc.Response.Data) {
				t.Fatalf("response %s, want %#v", actualBytes, tc.Response.Data)
			}
		})
	}

	for name := range names {
		if !seen[name] {
			t.Errorf("missing Phase 2 contract case %q", name)
		}
	}
}
