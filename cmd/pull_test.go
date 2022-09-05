package cmd

import (
	"github.com/stretchr/testify/assert"
	"reflect"
	"testing"
)

func Test_pgDumpSchemasFlags(t *testing.T) {
	type args struct {
		schemas []string
	}
	tests := []struct {
		name    string
		schemas []string
		want    []string
	}{
		{
			name:    "test",
			schemas: []string{"public", "my_schema1", "my_schema2"},
			want:    []string{"--schema", "public", "--schema", "my_schema1", "--schema", "my_schema2"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pgDumpSchemasFlags(tt.schemas); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("pgDumpSchemasFlags() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_wrapFunctionsDump(t *testing.T) {
	dump := []byte(`
CREATE FUNCTION public.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := new;
  _new. "updated_at" = now();
  RETURN _new;
END;
$$;

CREATE TABLE foo.bar (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
);

CREATE FUNCTION public.add(integer, integer) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$select $1 + $2;$_$;
`)

	expected := []byte(`
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := new;
  _new. "updated_at" = now();
  RETURN _new;
END;
$$;

CREATE TABLE foo.bar (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
);

CREATE OR REPLACE FUNCTION public.add(integer, integer) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$select $1 + $2;$_$;
`)

	assert.Equal(t, expected, wrapFunctionsDump(dump))
}
