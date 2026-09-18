package migrations_test

import (
	"embed"
	"testing"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const postgresMigrationPath = "postgres"

//go:embed postgres/*.sql
var postgresMigrations embed.FS

func TestPostgresMigrationBundle(t *testing.T) {
	t.Parallel()

	if err := pgmigrate.ValidateBundle(postgresMigrations, postgresMigrationPath); err != nil {
		t.Fatalf("ValidateBundle() error = %v", err)
	}
}
