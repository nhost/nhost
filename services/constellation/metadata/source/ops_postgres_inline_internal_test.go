package source //nolint:testpackage // exercises unexported builders + fakes

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// TestPgTrackTable_InlineRelationships covers the inline object/array
// relationship path of pg_track_table: the three name-collision rejects
// (duplicate within objects, duplicate within arrays, name present in both)
// and the successful-append branch. Every other pg_track_table test passes a
// bare {source, table}, so this is the only coverage of that logic.
func TestPgTrackTable_InlineRelationships(t *testing.T) {
	t.Parallel()

	const (
		objCustomer = `{"name":"customer","using":{"foreign_key_constraint_on":"customer_id"}}`
		objSeller   = `{"name":"seller","using":{"foreign_key_constraint_on":"seller_id"}}`
		arrItems    = `{"name":"items","using":{"foreign_key_constraint_on":` +
			`{"table":{"schema":"public","name":"order_items"},"column":"order_id"}}}`
		arrItemsDup = `{"name":"items","using":{"foreign_key_constraint_on":` +
			`{"table":{"schema":"public","name":"order_refunds"},"column":"order_id"}}}`
	)

	cases := []struct {
		name    string
		table   string
		objs    string
		arrs    string
		wantErr error
	}{
		{
			name:    "duplicate object relationship name rejected",
			table:   "orders_a",
			objs:    objCustomer + `,` + objCustomer,
			wantErr: ErrRelationshipExists,
		},
		{
			name:    "duplicate array relationship name rejected",
			table:   "orders_b",
			arrs:    arrItems + `,` + arrItemsDup,
			wantErr: ErrRelationshipExists,
		},
		{
			name:    "name present in both object and array lists rejected",
			table:   "orders_c",
			objs:    `{"name":"items","using":{"foreign_key_constraint_on":"items_id"}}`,
			arrs:    arrItems,
			wantErr: ErrRelationshipExists,
		},
		{
			name:  "distinct inline relationship names persist",
			table: "orders_d",
			objs:  objCustomer + `,` + objSeller,
			arrs:  arrItems,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := bootstrappedStore(t, &fakeWriter{}) // rv=7, empty tables

			args := `{"source":"default","table":{"schema":"public","name":"` + tc.table + `"}`
			if tc.objs != "" {
				args += `,"object_relationships":[` + tc.objs + `]`
			}

			if tc.arrs != "" {
				args += `,"array_relationships":[` + tc.arrs + `]`
			}

			args += `}`

			_, code, err := s.PgTrackTable(t.Context(), []byte(args))

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("err = %v, want %v", err, tc.wantErr)
				}

				if rv := s.ResourceVersion(); rv != 7 {
					t.Errorf("ResourceVersion = %d, want 7 (reject must not write)", rv)
				}

				return
			}

			if err != nil {
				t.Fatalf("PgTrackTable: %v", err)
			}

			if code != "" {
				t.Errorf("idempotency code = %q, want empty", code)
			}

			// Persist branch: the table and its distinct inline relationships
			// must be present in the swapped snapshot.
			raw, _ := s.HasuraSnapshotJSON()

			meta, err := hasura.FromJSON(raw)
			if err != nil {
				t.Fatalf("FromJSON(snapshot): %v", err)
			}

			tbl := findTrackedTable(t, meta, tc.table)

			if names := objNames(tbl.ObjectRelationships); !equalUnordered(names, []string{"customer", "seller"}) {
				t.Errorf("object relationships = %v, want [customer seller]", names)
			}

			if names := arrNames(tbl.ArrayRelationships); !equalUnordered(names, []string{"items"}) {
				t.Errorf("array relationships = %v, want [items]", names)
			}
		})
	}
}

func findTrackedTable(t *testing.T, meta *hasura.Metadata, name string) hasura.TableMetadata {
	t.Helper()

	for _, db := range meta.Databases {
		for _, tbl := range db.Tables {
			if tbl.Table.Name == name {
				return tbl
			}
		}
	}

	t.Fatalf("table %q not found in snapshot", name)

	return hasura.TableMetadata{}
}

func objNames(rels []hasura.ObjectRelationship) []string {
	out := make([]string, len(rels))
	for i, r := range rels {
		out[i] = r.Name
	}

	return out
}

func arrNames(rels []hasura.ArrayRelationship) []string {
	out := make([]string, len(rels))
	for i, r := range rels {
		out[i] = r.Name
	}

	return out
}

func equalUnordered(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}

	seen := make(map[string]int, len(want))
	for _, w := range want {
		seen[w]++
	}

	for _, g := range got {
		seen[g]--
	}

	for _, c := range seen {
		if c != 0 {
			return false
		}
	}

	return true
}
