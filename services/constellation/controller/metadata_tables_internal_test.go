package controller

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestDispatch_PgUntrackTable_NoCascade_Fails(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	// Add a permission so the table has a dependent.
	if code, body := postJSON(t, router,
		`{"type":"pg_create_select_permission","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"role":"user",`+
			`"permission":{"columns":["id"],"filter":{}}}}`); code != http.StatusOK {
		t.Fatalf("seed perm: %d %v", code, body)
	}

	// Untrack without cascade → dependency error.
	code, body := postJSON(t, router,
		`{"type":"pg_untrack_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"}}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["code"] != "dependency-error" {
		t.Errorf("code=%v, want dependency-error", body["code"])
	}
}

func TestDispatch_PgUntrackTable_Cascade_Succeeds(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	if code, _ := postJSON(t, router,
		`{"type":"pg_create_select_permission","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"role":"user",`+
			`"permission":{"columns":["id"],"filter":{}}}}`); code != http.StatusOK {
		t.Fatal("seed perm")
	}

	code, body := postJSON(t, router,
		`{"type":"pg_untrack_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"cascade":true}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}
}

func TestDispatch_PgSetTableIsEnum(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	code, body := postJSON(t, router,
		`{"type":"pg_set_table_is_enum","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"is_enum":true}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}
}

func TestDispatch_PgDropRelationship_NotFound(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	code, body := postJSON(t, router,
		`{"type":"pg_drop_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"relationship":"ghost"}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("code=%v, want not-exists", body["code"])
	}
}

func TestDispatch_PgRenameRelationship(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	// Track an object relationship so rename has something to operate on.
	if code, _ := postJSON(t, router,
		`{"type":"pg_create_object_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"owner",`+
			`"using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}}`); code != http.StatusOK {
		t.Fatal("seed rel")
	}

	code, body := postJSON(t, router,
		`{"type":"pg_rename_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"owner","new_name":"creator"}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["message"] != "success" {
		t.Errorf("message=%v, want success", body["message"])
	}

	// Re-name with same name = idempotent.
	code, body = postJSON(t, router,
		`{"type":"pg_rename_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"creator","new_name":"creator"}}`)
	if code != http.StatusOK {
		t.Fatalf("idempotent rename: status=%d body=%v", code, body)
	}

	if body["message"] != "already-exists" {
		t.Errorf("message=%v, want already-exists", body["message"])
	}

	// Self-rename of a relationship that does NOT exist must report
	// not-exists, not already-exists: the idempotency shortcut only fires
	// once the relationship is found.
	code, body = postJSON(t, router,
		`{"type":"pg_rename_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"ghost","new_name":"ghost"}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("missing self-rename: status=%d body=%v", code, body)
	}

	if body["code"] != "not-exists" {
		t.Errorf("code=%v, want not-exists", body["code"])
	}
}

// TestDispatch_PgRenameRelationship_Collision verifies that renaming a
// relationship onto a name already used by a different relationship on the
// same table is rejected with already-exists, rather than silently creating
// two relationships that share one GraphQL field name.
func TestDispatch_PgRenameRelationship_Collision(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	for _, name := range []string{"owner", "creator"} {
		if code, body := postJSON(
			t, router,
			`{"type":"pg_create_object_relationship","args":{"source":"default",`+
				`"table":{"schema":"public","name":"users"},"name":"`+name+`",`+
				`"using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}}`,
		); code != http.StatusOK {
			t.Fatalf("seed %q: status=%d body=%v", name, code, body)
		}
	}

	writesBefore := w.callCount()

	// Rename owner → creator: creator already exists, so this must fail.
	code, body := postJSON(t, router,
		`{"type":"pg_rename_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"owner","new_name":"creator"}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["code"] != "already-exists" {
		t.Errorf("code=%v, want already-exists", body["code"])
	}

	if w.callCount() != writesBefore {
		t.Errorf(
			"writer calls = %d, want %d (collision must not write)",
			w.callCount(),
			writesBefore,
		)
	}
}

// TestDispatch_PgCreateObjectRelationship_PersistsComment verifies the
// relationship `comment` field is written into the snapshot rather than
// silently dropped.
func TestDispatch_PgCreateObjectRelationship_PersistsComment(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)
	trackUsers(t, router)

	code, body := postJSON(t, router,
		`{"type":"pg_create_object_relationship","args":{"source":"default",`+
			`"table":{"schema":"public","name":"users"},"name":"owner","comment":"the owner",`+
			`"using":{"manual_configuration":{"remote_table":{"schema":"public","name":"users"},"column_mapping":{"id":"id"}}}}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	raw, _ := store.HasuraSnapshotJSON()
	if got := string(raw); !strings.Contains(got, `"comment":"the owner"`) {
		t.Errorf("snapshot missing relationship comment; raw = %s", got)
	}
}

// --- read ops with a fake queryer ---

// fakeQueryer is a Queryer that satisfies the multi-row widening in
// ops_reads.go by also providing Query. It returns canned rows.
type fakeQueryer struct {
	viewdef string
	// fkRows mirror suggestRelationshipsSQL's 8 columns, in order:
	// constraint_schema, constraint_name, from_schema, from_table,
	// from_column, to_schema, to_table, to_column.
	fkRows [][8]string
}

func (f *fakeQueryer) QueryRow(
	_ context.Context, _ string, _ ...any,
) pgx.Row {
	return fakeViewdefRow{viewdef: f.viewdef}
}

func (f *fakeQueryer) Query(
	_ context.Context, _ string, _ ...any,
) (pgx.Rows, error) {
	return &fakeRows{rows: f.fkRows, idx: -1}, nil
}

type fakeViewdefRow struct {
	viewdef string
}

func (r fakeViewdefRow) Scan(dest ...any) error {
	if len(dest) == 1 {
		if p, ok := dest[0].(*string); ok {
			*p = r.viewdef
		}
	}

	return nil
}

type fakeRows struct {
	rows [][8]string
	idx  int
}

func (r *fakeRows) Close()                                       {}
func (r *fakeRows) Err() error                                   { return nil }
func (r *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRows) Conn() *pgx.Conn                              { return nil }
func (r *fakeRows) RawValues() [][]byte                          { return nil }
func (r *fakeRows) Values() ([]any, error)                       { return nil, nil }
func (r *fakeRows) Next() bool {
	r.idx++

	return r.idx < len(r.rows)
}

func (r *fakeRows) Scan(dest ...any) error {
	if r.idx >= len(r.rows) {
		return pgx.ErrNoRows
	}

	row := r.rows[r.idx]
	for i := range dest {
		if i >= len(row) {
			break
		}

		if p, ok := dest[i].(*string); ok {
			*p = row[i]
		}
	}

	return nil
}

func TestDispatch_PgGetViewdef_Success(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStoreWithQueryer(t, w, &fakeQueryer{viewdef: "SELECT 1;"})
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"pg_get_viewdef","args":{"source":"default",`+
			`"table":{"schema":"public","name":"v"}}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if got, _ := body["viewdef"].(string); got != "SELECT 1;" {
		t.Errorf("viewdef=%q, want %q", body["viewdef"], "SELECT 1;")
	}
}

func TestDispatch_PgGetViewdef_NoDB_NotSupported(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStore(t, w)
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"pg_get_viewdef","args":{"source":"default",`+
			`"table":{"schema":"public","name":"v"}}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%v", code, body)
	}

	if body["code"] != "not-supported" {
		t.Errorf("code=%v, want not-supported", body["code"])
	}
}

func TestDispatch_PgSuggestRelationships_NoFilter(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStoreWithQueryer(t, w, &fakeQueryer{
		fkRows: [][8]string{
			{"public", "posts_user_id_fkey", "public", "posts", "user_id", "public", "users", "id"},
		},
	})
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"pg_suggest_relationships","args":{"source":"default"}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	rels, _ := body["relationships"].([]any)
	if len(rels) != 2 {
		t.Fatalf("got %d suggestions, want 2 (one FK = object + array)", len(rels))
	}
}

// TestDispatch_PgSuggestRelationships_CompositeFK verifies a two-column FK
// folds into a single object + single array suggestion, each carrying BOTH
// columns in order — not the N*N single-column cartesian product the old
// constraint_column_usage join produced.
func TestDispatch_PgSuggestRelationships_CompositeFK(t *testing.T) {
	t.Parallel()

	w := &writerStub{}
	store := newBootstrappedStoreWithQueryer(t, w, &fakeQueryer{
		// Two rows, same constraint, ordered by ordinal position — as
		// suggestRelationshipsSQL's ORDER BY guarantees.
		fkRows: [][8]string{
			{
				"public",
				"line_items_order_fkey",
				"public",
				"line_items",
				"order_id",
				"public",
				"orders",
				"id",
			},
			{
				"public",
				"line_items_order_fkey",
				"public",
				"line_items",
				"order_org",
				"public",
				"orders",
				"org",
			},
		},
	})
	router := buildMutationRouter(t, store)

	code, body := postJSON(t, router,
		`{"type":"pg_suggest_relationships","args":{"source":"default"}}`)
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%v", code, body)
	}

	rels, _ := body["relationships"].([]any)
	if len(rels) != 2 {
		t.Fatalf("got %d suggestions, want 2 (one composite FK = object + array)", len(rels))
	}

	// The object suggestion's `from` columns must be exactly the two FK
	// columns, in order.
	obj, _ := rels[0].(map[string]any)
	from, _ := obj["from"].(map[string]any)
	cols, _ := from["columns"].([]any)

	if len(cols) != 2 || cols[0] != "order_id" || cols[1] != "order_org" {
		t.Errorf("object from.columns = %v, want [order_id order_org]", cols)
	}
}

// The file-source read-op behavior (ErrReadOpRequiresDB when no Queryer is
// attached) is exercised white-box in the source package; see
// TestStore_PgGetViewdef_RequiresDB in metadata/source. The controller's
// mapping of that sentinel to "not-supported" is covered above by
// TestDispatch_PgGetViewdef_NoDB_NotSupported.
