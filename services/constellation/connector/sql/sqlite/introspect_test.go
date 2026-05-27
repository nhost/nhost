package sqlite_test

import (
	"database/sql"
	"flag"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"

	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var updateGolden = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

// testSchema exercises all SQLite introspection code paths:
//   - Various column types (INTEGER, TEXT, REAL, BOOLEAN, BLOB, JSON, DATE, DATETIME, UUID, NUMERIC)
//   - Single and composite primary keys
//   - Foreign keys
//   - Unique constraints
//   - Generated columns (STORED)
//   - Default values
//   - Nullable and non-nullable columns
//   - Enum table pattern
const testSchema = `
CREATE TABLE department_roles (
    type TEXT NOT NULL PRIMARY KEY,
    description TEXT
);

CREATE TABLE departments (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    budget NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    rating REAL,
    logo BLOB,
    metadata JSON,
    founded_date DATE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX departments_name_key ON departments(name);

CREATE TABLE users (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    age INTEGER,
    score REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX users_email_key ON users(email);

CREATE TABLE user_departments (
    user_id UUID NOT NULL,
    department_id TEXT NOT NULL,
    role TEXT,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (role) REFERENCES department_roles(type)
);

CREATE TABLE items (
    id INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    total REAL GENERATED ALWAYS AS (price * quantity) STORED
);
`

func TestIntrospect(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	if _, err := db.ExecContext(t.Context(), testSchema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	if _, err := db.ExecContext(t.Context(), `
		INSERT INTO department_roles (type, description) VALUES ('manager', 'Department manager');
		INSERT INTO department_roles (type, description) VALUES ('member', 'Regular member');
	`); err != nil {
		t.Fatalf("failed to insert enum data: %v", err)
	}

	db.Close()

	sqlDB, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	client := sqlite.NewClient(sqlDB)
	t.Cleanup(func() { client.Close() })

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "", Name: "department_roles"},
				IsEnum: true,
			},
			{Table: metadata.TableSource{Schema: "", Name: "departments"}},
			{Table: metadata.TableSource{Schema: "", Name: "users"}},
			{Table: metadata.TableSource{Schema: "", Name: "user_departments"}},
			{Table: metadata.TableSource{Schema: "", Name: "items"}},
		},
	}

	got, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("failed to introspect: %v", err)
	}

	goldenPath := filepath.Join("testdata", "TestIntrospect/success.golden.json")
	if err := os.MkdirAll(filepath.Dir(goldenPath), 0o755); err != nil {
		t.Fatalf("failed to create testdata directory: %v", err)
	}

	testhelpers.GoldenJSON(t, goldenPath, got, *updateGolden)
}

// TestIntrospectViewMutability covers the INSTEAD OF trigger detection in
// introspectTable. The default golden test above intentionally has no views,
// so this test sets up the matrix of view shapes (no triggers, INSTEAD OF
// INSERT only, INSTEAD OF UPDATE only, INSTEAD OF DELETE only, all three)
// and asserts that IsInsertable / IsUpdatable reflect the writable surface
// the database actually exposes.
func TestIntrospectViewMutability(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "views.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	schema := `
CREATE TABLE base (id INTEGER PRIMARY KEY, name TEXT);

CREATE VIEW v_readonly AS SELECT id, name FROM base;

CREATE VIEW v_insert_only AS SELECT id, name FROM base;
CREATE TRIGGER v_insert_only_ins INSTEAD OF INSERT ON v_insert_only
BEGIN INSERT INTO base(id, name) VALUES (NEW.id, NEW.name); END;

CREATE VIEW v_update_only AS SELECT id, name FROM base;
CREATE TRIGGER v_update_only_upd INSTEAD OF UPDATE ON v_update_only
BEGIN UPDATE base SET name = NEW.name WHERE id = OLD.id; END;

CREATE VIEW v_delete_only AS SELECT id, name FROM base;
CREATE TRIGGER v_delete_only_del INSTEAD OF DELETE ON v_delete_only
BEGIN DELETE FROM base WHERE id = OLD.id; END;

CREATE VIEW v_full AS SELECT id, name FROM base;
CREATE TRIGGER v_full_ins INSTEAD OF INSERT ON v_full
BEGIN INSERT INTO base(id, name) VALUES (NEW.id, NEW.name); END;
CREATE TRIGGER v_full_upd INSTEAD OF UPDATE ON v_full
BEGIN UPDATE base SET name = NEW.name WHERE id = OLD.id; END;
CREATE TRIGGER v_full_del INSTEAD OF DELETE ON v_full
BEGIN DELETE FROM base WHERE id = OLD.id; END;

-- v_body_false_positive only has an INSTEAD OF INSERT trigger (so the
-- view should be insertable but NOT updatable), but the trigger body
-- contains the literal phrases "INSTEAD OF UPDATE" and "INSTEAD OF DELETE"
-- inside a string literal and a comment. The header-only header parse must
-- ignore those occurrences and not flip IsUpdatable to true.
CREATE VIEW v_body_false_positive AS SELECT id, name FROM base;
CREATE TRIGGER v_body_false_positive_ins INSTEAD OF INSERT ON v_body_false_positive
BEGIN
    -- the following comment mentions INSTEAD OF UPDATE on purpose
    INSERT INTO base(id, name) VALUES (NEW.id, NEW.name || ' INSTEAD OF DELETE');
END;

-- v_begin and its begin_audit trigger both have identifiers that contain the
-- literal substring "BEGIN". A naive strings.Index(upper, "BEGIN") would
-- truncate the header at the first textual match (inside an identifier)
-- and drop the INSTEAD OF INSERT clause, regressing IsInsertable to false.
-- The word-boundary BEGIN scan must keep IsInsertable=true here.
CREATE VIEW v_begin AS SELECT id, name FROM base;
CREATE TRIGGER begin_audit INSTEAD OF INSERT ON v_begin
BEGIN INSERT INTO base(id, name) VALUES (NEW.id, NEW.name); END;

-- v_header_comment_mismatch has a single trigger whose actual event is
-- INSTEAD OF UPDATE, but the header carries a SQL line comment that
-- mentions "INSTEAD OF INSERT". A switch-based detector would let the
-- INSERT branch win for this trigger row and incorrectly flip
-- IsInsertable while leaving IsUpdatable false — masking the real
-- UPDATE event. With independent checks, IsUpdatable must be true; the
-- comment-induced INSERT match is an accepted over-detection that is
-- consistent with the rest of the header-parsing approach (errs toward
-- exposing mutations).
CREATE VIEW v_header_comment_mismatch AS SELECT id, name FROM base;
CREATE TRIGGER v_header_comment_mismatch_upd
    -- the next line says INSTEAD OF INSERT on purpose to bait a false positive
    INSTEAD OF UPDATE ON v_header_comment_mismatch
BEGIN UPDATE base SET name = NEW.name WHERE id = OLD.id; END;
`

	if _, err := db.ExecContext(t.Context(), schema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	db.Close()

	sqlDB, err := sqlite.Open(t.Context(), dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}

	client := sqlite.NewClient(sqlDB)
	t.Cleanup(func() { client.Close() })

	got, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Name: "base"}},
			{Table: metadata.TableSource{Name: "v_readonly"}},
			{Table: metadata.TableSource{Name: "v_insert_only"}},
			{Table: metadata.TableSource{Name: "v_update_only"}},
			{Table: metadata.TableSource{Name: "v_delete_only"}},
			{Table: metadata.TableSource{Name: "v_full"}},
			{Table: metadata.TableSource{Name: "v_body_false_positive"}},
			{Table: metadata.TableSource{Name: "v_begin"}},
			{Table: metadata.TableSource{Name: "v_header_comment_mismatch"}},
		},
	})
	if err != nil {
		t.Fatalf("failed to introspect: %v", err)
	}

	schemaObjs := got.Schemas[""]
	if schemaObjs == nil {
		t.Fatalf("expected default schema in introspection objects")
	}

	cases := []struct {
		name           string
		wantIsView     bool
		wantInsertable bool
		wantUpdatable  bool
	}{
		{"base", false, true, true},
		{"v_readonly", true, false, false},
		{"v_insert_only", true, true, false},
		{"v_update_only", true, false, true},
		{"v_delete_only", true, false, true},
		{"v_full", true, true, true},
		{"v_body_false_positive", true, true, false},
		{"v_begin", true, true, false},
		{"v_header_comment_mismatch", true, true, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tbl, ok := schemaObjs.Tables[tc.name]
			if !ok {
				t.Fatalf("missing relation %q in introspection", tc.name)
			}

			if tbl.IsView != tc.wantIsView {
				t.Errorf("IsView = %v, want %v", tbl.IsView, tc.wantIsView)
			}

			if tbl.IsInsertable != tc.wantInsertable {
				t.Errorf("IsInsertable = %v, want %v", tbl.IsInsertable, tc.wantInsertable)
			}

			if tbl.IsUpdatable != tc.wantUpdatable {
				t.Errorf("IsUpdatable = %v, want %v", tbl.IsUpdatable, tc.wantUpdatable)
			}
		})
	}
}
