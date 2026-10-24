package usage_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq"
	"github.com/nhost/nhost/services/storage/migrations"
	"github.com/nhost/nhost/services/storage/usage"
	"github.com/nhost/nhost/services/storage/usage/mock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"go.uber.org/mock/gomock"
)

var errUnavailable = errors.New("unavailable")

func TestCollector(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		total   int64
		err     error
		want    float64
		wantErr bool
	}{
		{name: "value", total: 42, want: 42},
		{name: "read error", err: errUnavailable, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			q := mock.NewMockQuerier(gomock.NewController(t))
			q.EXPECT().Total(gomock.Any()).Return(tt.total, tt.err)

			registry := prometheus.NewRegistry()
			if err := registry.Register(usage.NewCollector(q)); err != nil {
				t.Fatal(err)
			}

			if tt.wantErr {
				if _, err := registry.Gather(); err == nil {
					t.Fatal("expected invalid metric error")
				}

				return
			}

			if diff := cmp.Diff(tt.want, testutil.ToFloat64(registry)); diff != "" {
				t.Errorf("metric (-want +got): %s", diff)
			}
		})
	}
}

//nolint:gocognit,cyclop,paralleltest // Ordered counter mutations share one database.
func TestReaderTotal(t *testing.T) {
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

	name := "storage_usage_reader_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if _, err := admin.Exec("DROP DATABASE " + name + " WITH (FORCE)"); err != nil {
			t.Errorf("drop database: %v", err)
		}
	})

	testSource := strings.Replace(source, "/postgres?", "/"+name+"?", 1)
	if testSource == source {
		t.Fatal("POSTGRES_MIGRATIONS_SOURCE must address postgres database")
	}

	db, err := sql.Open("postgres", testSource)
	if err != nil {
		t.Fatal(err)
	}

	for _, query := range []string{"CREATE SCHEMA storage", "CREATE EXTENSION pgcrypto WITH SCHEMA public"} {
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}

	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	if err := migrations.ApplyPostgresMigration(testSource); err != nil {
		t.Fatal(err)
	}

	pool, err := pgxpool.New(context.Background(), testSource)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)
	reader := usage.NewReader(pool)

	tests := []struct {
		name, query string
		want        int64
		wantErr     bool
	}{
		{name: "empty", want: 0},
		{
			name:  "uploaded",
			query: "INSERT INTO storage.files (name,size,is_uploaded) VALUES ('uploaded',73,true),('pending',200,false)",
			want:  73,
		},
		{name: "missing counter", query: "DELETE FROM storage.usage", wantErr: true},
	}
	//nolint:paralleltest // Counter cases depend on preceding database state.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.query != "" {
				if _, err := pool.Exec(context.Background(), tt.query); err != nil {
					t.Fatal(err)
				}
			}

			got, err := reader.Total(context.Background())
			if (err != nil) != tt.wantErr {
				t.Fatalf("Total error = %v, want error %v", err, tt.wantErr)
			}

			if !tt.wantErr {
				if diff := cmp.Diff(tt.want, got); diff != "" {
					t.Errorf("Total (-want +got): %s", diff)
				}
			}
		})
	}
}
