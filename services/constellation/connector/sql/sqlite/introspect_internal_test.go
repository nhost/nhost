package sqlite

import "testing"

func TestMapSQLiteType(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input    string
		expected string
	}{
		// Integer types
		{"INTEGER", "int8"},
		{"INT", "int8"},
		{"BIGINT", "int8"},
		{"SMALLINT", "int8"},
		{"TINYINT", "int8"},
		{"MEDIUMINT", "int8"},
		{"integer", "int8"},

		// Real types
		{"REAL", "float8"},
		{"FLOAT", "float8"},
		{"DOUBLE", "float8"},
		{"DOUBLE PRECISION", "float8"},

		// Boolean
		{"BOOLEAN", "bool"},
		{"BOOL", "bool"},

		// Numeric
		{"NUMERIC", "numeric"},
		{"DECIMAL", "numeric"},
		{"NUMERIC(10,2)", "numeric"},
		{"DECIMAL(5)", "numeric"},

		// Text types
		{"TEXT", "text"},
		{"CLOB", "text"},
		{"VARCHAR(255)", "text"},
		{"CHAR(10)", "text"},
		{"VARYING CHARACTER(100)", "text"},
		{"NCHAR(50)", "text"},
		{"NVARCHAR(100)", "text"},
		{"NATIVE CHARACTER(70)", "text"},

		// Blob / empty
		{"BLOB", "bytea"},
		{"", "bytea"},

		// Date/time
		{"DATE", "date"},
		{"DATETIME", "timestamptz"},
		{"TIMESTAMP", "timestamptz"},
		{"TIMESTAMP WITH TIME ZONE", "timestamptz"},

		// UUID
		{"UUID", "uuid"},

		// JSON
		{"JSON", "json"},
		{"JSONB", "json"},

		// Unknown falls back to text
		{"UNKNOWNTYPE", "text"},

		// Whitespace trimming
		{"  INTEGER  ", "int8"},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()

			got := mapSQLiteType(tc.input)
			if got != tc.expected {
				t.Errorf("mapSQLiteType(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestTypeSupportsMinMax(t *testing.T) {
	t.Parallel()

	cases := []struct {
		mapped string
		want   bool
	}{
		{"int8", true},
		{"float8", true},
		{"numeric", true},
		{"text", true},
		{"date", true},
		{"timestamptz", true},
		{"uuid", true},
		{"bool", false},
		{"bytea", false},
		{"json", false},
		{"unknown", false},
	}

	for _, tc := range cases {
		t.Run(tc.mapped, func(t *testing.T) {
			t.Parallel()

			if got := typeSupportsMinMax(tc.mapped); got != tc.want {
				t.Errorf("typeSupportsMinMax(%q) = %v, want %v", tc.mapped, got, tc.want)
			}
		})
	}
}

func TestTypeSupportsInc(t *testing.T) {
	t.Parallel()

	cases := []struct {
		mapped string
		want   bool
	}{
		{"int8", true},
		{"float8", true},
		{"numeric", true},
		{"bool", false},
		{"text", false},
		{"date", false},
		{"timestamptz", false},
		{"uuid", false},
		{"bytea", false},
		{"json", false},
	}

	for _, tc := range cases {
		t.Run(tc.mapped, func(t *testing.T) {
			t.Parallel()

			if got := typeSupportsInc(tc.mapped); got != tc.want {
				t.Errorf("typeSupportsInc(%q) = %v, want %v", tc.mapped, got, tc.want)
			}
		})
	}
}

func TestTypeSupportsAgg(t *testing.T) {
	t.Parallel()

	cases := []struct {
		mapped string
		want   bool
	}{
		{"int8", true},
		{"float8", true},
		{"numeric", true},
		{"bool", false},
		{"text", false},
		{"date", false},
		{"timestamptz", false},
		{"uuid", false},
		{"bytea", false},
		{"json", false},
	}

	for _, tc := range cases {
		t.Run(tc.mapped, func(t *testing.T) {
			t.Parallel()

			if got := typeSupportsAgg(tc.mapped); got != tc.want {
				t.Errorf("typeSupportsAgg(%q) = %v, want %v", tc.mapped, got, tc.want)
			}
		})
	}
}
