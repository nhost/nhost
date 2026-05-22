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
