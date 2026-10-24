package migrations_test

import (
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/nhost/nhost/services/storage/migrations"
)

func usageDatabase(t *testing.T) (*sql.DB, string, string) {
	t.Helper()

	source := os.Getenv("POSTGRES_MIGRATIONS_SOURCE")
	if source == "" {
		source = "postgres://postgres:hejsan@localhost:5432/postgres?sslmode=disable"
	}

	admin, err := sql.Open("postgres", source)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := admin.Close(); err != nil {
			t.Errorf("close admin: %v", err)
		}
	})

	if err := admin.Ping(); err != nil {
		t.Fatalf("postgres unavailable: %v", err)
	}

	name := "storage_usage_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if _, err := admin.Exec("DROP DATABASE " + name + " WITH (FORCE)"); err != nil {
			t.Errorf("drop test database: %v", err)
		}
	})

	testSource := strings.Replace(source, "/postgres?", "/"+name+"?", 1)
	if testSource == source {
		t.Fatal("POSTGRES_MIGRATIONS_SOURCE must address the postgres database")
	}

	db, err := sql.Open("postgres", testSource)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("close test database: %v", err)
		}
	})

	for _, query := range []string{"CREATE SCHEMA storage", "CREATE EXTENSION pgcrypto WITH SCHEMA public"} {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}

	if err := migrations.ApplyPostgresMigration(testSource); err != nil {
		t.Fatal(err)
	}

	return db, testSource, name
}

func checkUsage(t *testing.T, db *sql.DB) int64 {
	t.Helper()

	var total, expected int64
	if err := db.QueryRow("SELECT total_bytes FROM storage.usage WHERE id").
		Scan(&total); err != nil {
		t.Fatal(err)
	}

	if err := db.QueryRow("SELECT coalesce(sum(size),0) FROM storage.files WHERE is_uploaded").
		Scan(&expected); err != nil {
		t.Fatal(err)
	}

	if total != expected {
		t.Fatalf("counter = %d, sum = %d", total, expected)
	}

	return total
}

func execUsage(t *testing.T, db *sql.DB, query string) {
	t.Helper()

	if _, err := db.Exec(query); err != nil {
		t.Fatal(err)
	}

	checkUsage(t, db)
}

func TestUsageMigration(t *testing.T) {
	t.Parallel()
	db, _, name := usageDatabase(t)

	testUsageAccounting(t, db)
	testUsageRestrictedWriter(t, db, name)
	testUsageLargeAndTruncate(t, db)
	testUsageDownAndUp(t, db)
}

func testUsageAccounting(t *testing.T, db *sql.DB) {
	t.Helper()

	if got := checkUsage(t, db); got != 0 {
		t.Fatalf("empty seed = %d", got)
	}

	execUsage(
		t,
		db,
		"INSERT INTO storage.files (name,size,is_uploaded) VALUES ('one',100,true)",
	)
	execUsage(
		t,
		db,
		"INSERT INTO storage.files (name,size,is_uploaded) VALUES ('pending',200,false),('null-size',NULL,true),('null-upload',300,NULL)",
	)
	execUsage(t, db, "UPDATE storage.files SET size=150 WHERE name='one'")
	execUsage(t, db, "UPDATE storage.files SET is_uploaded=true WHERE name='pending'")
	execUsage(t, db, "UPDATE storage.files SET is_uploaded=false WHERE name='pending'")

	var before, after string
	if err := db.QueryRow("SELECT xmin::text FROM storage.usage").Scan(&before); err != nil {
		t.Fatal(err)
	}

	execUsage(t, db, "UPDATE storage.files SET name='renamed' WHERE name='one'")

	if err := db.QueryRow("SELECT xmin::text FROM storage.usage").Scan(&after); err != nil {
		t.Fatal(err)
	}

	if before != after {
		t.Fatal("metadata update touched usage row")
	}

	execUsage(t, db, "UPDATE storage.files SET is_uploaded=false WHERE name='renamed'")
	execUsage(t, db, "UPDATE storage.files SET size=170 WHERE name='renamed'")
	execUsage(t, db, "UPDATE storage.files SET is_uploaded=true WHERE name='renamed'")
}

func testUsageRestrictedWriter(t *testing.T, db *sql.DB, name string) {
	t.Helper()

	role := name + "_writer"
	for _, query := range []string{
		"CREATE ROLE " + role,
		"GRANT USAGE ON SCHEMA storage TO " + role,
		"GRANT INSERT, UPDATE, DELETE, SELECT ON storage.files TO " + role,
	} {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}

	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			t.Errorf("rollback: %v", err)
		}
	}()

	if _, err := tx.Exec("SET LOCAL ROLE " + role); err != nil {
		t.Fatal(err)
	}

	if _, err := tx.Exec(
		"INSERT INTO storage.files (id,name,size,is_uploaded) VALUES ($1,'restricted',5,true)",
		uuid.NewString(),
	); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	checkUsage(t, db)

	for _, query := range []string{
		"REVOKE ALL ON storage.files FROM " + role,
		"REVOKE ALL ON SCHEMA storage FROM " + role,
		"DROP ROLE " + role,
	} {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
}

func testUsageLargeAndTruncate(t *testing.T, db *sql.DB) {
	t.Helper()
	execUsage(
		t,
		db,
		"INSERT INTO storage.files (name,size,is_uploaded) VALUES ('large',2147483647,true),('extra',10,true)",
	)

	if got := checkUsage(t, db); got <= 2147483647 {
		t.Fatalf("expected bigint total, got %d", got)
	}

	execUsage(t, db, "DELETE FROM storage.files WHERE name='extra'")
	execUsage(t, db, "TRUNCATE storage.files CASCADE")

	if got := checkUsage(t, db); got != 0 {
		t.Fatalf("truncate total = %d", got)
	}
}

func testUsageDownAndUp(t *testing.T, db *sql.DB) {
	t.Helper()

	down, err := os.ReadFile("postgres/000006_add-usage-counter.down.sql")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(string(down)); err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(
		"INSERT INTO storage.files (name,size,is_uploaded) VALUES ('seed',42,true),('empty',NULL,true),('false',99,false),('unknown',99,NULL)",
	); err != nil {
		t.Fatal(err)
	}

	up, err := os.ReadFile("postgres/000006_add-usage-counter.up.sql")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(string(up)); err != nil {
		t.Fatal(err)
	}

	if got := checkUsage(t, db); got != 42 {
		t.Fatalf("seed = %d", got)
	}

	execUsage(t, db, "UPDATE storage.files SET size=43 WHERE name='seed'")
}
