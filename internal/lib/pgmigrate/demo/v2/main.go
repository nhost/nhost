// Command v2 demonstrates startup migrations for tutorial v2.
package main

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"os"

	_ "github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

const migrationConnections = 2

//go:embed migrations/*.sql
var migrations embed.FS

var errMissingDatabaseURL = errors.New("set DATABASE_URL before starting the app")

func main() {
	if err := run(context.Background(), os.Getenv("DATABASE_URL")); err != nil {
		log.Fatal(err)
	}

	if _, err := fmt.Fprintln(os.Stdout, "Hello from v2!"); err != nil {
		log.Fatalf("printing greeting: %v", err)
	}
}

func run(ctx context.Context, dsn string) (err error) {
	if dsn == "" {
		return errMissingDatabaseURL
	}

	database, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("opening migration database: %w", err)
	}
	defer func() {
		if closeErr := database.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing migration database: %w", closeErr))
		}
	}()

	database.SetMaxOpenConns(migrationConnections)

	if err := pgmigrate.Migrate(
		ctx, slog.Default(), database, migrations, "migrations", "hello",
	); err != nil {
		return fmt.Errorf("migrating hello schema: %w", err)
	}

	return nil
}
