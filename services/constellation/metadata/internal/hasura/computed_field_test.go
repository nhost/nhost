package hasura_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func TestComputedFieldsWireRoundTrip(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		fields   string
		grants   string
		invalids int
	}{
		{name: "absent", fields: "", grants: "", invalids: 0},
		{name: "null", fields: `null`, grants: `null`, invalids: 0},
		{name: "empty", fields: `[]`, grants: `[]`, invalids: 0},
		{name: "malformed lists", fields: `42`, grants: `{"bad":true}`, invalids: 1},
		{
			name:     "mixed entries",
			fields:   `[{"name":"good","definition":{"function":"f","future":true},"comment":"yes"},{"name":"bad","definition":{"function":false}},null]`,
			grants:   `["good",null,7]`,
			invalids: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			fields, grants := "", ""
			if tt.fields != "" {
				fields = `,"computed_fields":` + tt.fields
			}

			if tt.grants != "" {
				grants = `,"computed_fields":` + tt.grants
			}

			input := `{"version":3,"sources":[{"name":"db","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/db"}},"tables":[{"table":{"schema":"public","name":"t"}` + fields + `,"select_permissions":[{"role":"r","permission":{"columns":"*","filter":{},"future":"ok"` + grants + `}}]}]}]}`

			wire, err := hasura.FromJSON([]byte(input))
			if err != nil {
				t.Fatal(err)
			}

			entries := wire.Databases[0].Tables[0].ComputedFields.Entries

			bad := 0
			for _, entry := range entries {
				if entry.DecodeError != nil {
					bad++
				}
			}

			if bad != tt.invalids {
				t.Fatalf("invalid fields = %d, want %d: %+v", bad, tt.invalids, entries)
			}

			out, err := hasura.ToJSON(wire)
			if err != nil {
				t.Fatal(err)
			}

			assertComputedWireJSON(t, []byte(input), out)
		})
	}
}

func TestComputedFieldsRecoverNameFromInvalidSibling(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		member string
	}{
		{name: "definition", member: `"definition":17`},
		{name: "table argument", member: `"definition":{"function":"f","table_argument":17}`},
		{
			name:   "session argument",
			member: `"definition":{"function":"f","session_argument":false}`,
		},
		{name: "comment", member: `"definition":{"function":"f"},"comment":false`},
	}

	for _, tc := range cases {
		for _, first := range []bool{true, false} {
			order := "name last"

			member := tc.member + `,"name":"broken"`
			if first {
				order = "name first"
				member = `"name":"broken",` + tc.member
			}

			t.Run(tc.name+"/"+order, func(t *testing.T) {
				t.Parallel()

				input := `{"version":3,"sources":[{"name":"db","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/db"}},"tables":[{"table":{"schema":"public","name":"items"},"computed_fields":[{` + member + `}]}]}]}`

				wire, err := hasura.FromJSON([]byte(input))
				if err != nil {
					t.Fatal(err)
				}

				entry := wire.Databases[0].Tables[0].ComputedFields.Entries[0]
				if entry.Name != "broken" || entry.DecodeError == nil ||
					!bytes.Equal(entry.Raw, []byte(`{`+member+`}`)) {
					t.Fatalf("invalid entry lost identity, error or raw JSON: %+v", entry)
				}

				snapshot, err := hasura.ToJSON(wire)
				if err != nil {
					t.Fatal(err)
				}

				reloaded, err := hasura.FromJSON(snapshot)
				if err != nil {
					t.Fatal(err)
				}

				again := reloaded.Databases[0].Tables[0].ComputedFields.Entries[0]
				if again.Name != entry.Name || again.DecodeError == nil ||
					!bytes.Equal(again.Raw, entry.Raw) {
					t.Fatalf("snapshot reload lost invalid identity: %+v", again)
				}
			})
		}
	}
}

func assertComputedWireJSON(t *testing.T, input, out []byte) {
	t.Helper()

	type permission struct {
		ComputedFields json.RawMessage `json:"computed_fields"`
		Future         string          `json:"future"`
	}

	type table struct {
		ComputedFields    json.RawMessage `json:"computed_fields"`
		SelectPermissions []struct {
			Permission permission `json:"permission"`
		} `json:"select_permissions"`
	}

	type envelope struct {
		Sources []struct {
			Tables []table `json:"tables"`
		} `json:"sources"`
	}

	var before, after envelope
	if err := json.Unmarshal(input, &before); err != nil {
		t.Fatal(err)
	}

	if err := json.Unmarshal(out, &after); err != nil {
		t.Fatal(err)
	}

	original := before.Sources[0].Tables[0]
	reencoded := after.Sources[0].Tables[0]

	if !bytes.Equal(original.ComputedFields, reencoded.ComputedFields) {
		t.Errorf(
			"computed fields changed: %s -> %s",
			original.ComputedFields,
			reencoded.ComputedFields,
		)
	}

	beforePermission := original.SelectPermissions[0].Permission
	afterPermission := reencoded.SelectPermissions[0].Permission

	if !bytes.Equal(beforePermission.ComputedFields, afterPermission.ComputedFields) ||
		beforePermission.Future != afterPermission.Future {
		t.Errorf("permission changed: %+v -> %+v", beforePermission, afterPermission)
	}
}
