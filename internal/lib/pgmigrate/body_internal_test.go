package pgmigrate

import "testing"

func TestContainsMigrationSQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		body string
		want bool
	}{
		{
			name: "empty",
			body: "",
			want: false,
		},
		{
			name: "whitespace only",
			body: " \t\r\n",
			want: false,
		},
		{
			name: "line comments only",
			body: "-- first\n -- second\r-- third",
			want: false,
		},
		{
			name: "block comment only",
			body: "/* placeholder */",
			want: false,
		},
		{
			name: "nested block comment only",
			body: "/* outer /* inner */ outer */",
			want: false,
		},
		{
			name: "mixed comments only",
			body: "-- line\r\n/* block */\t-- tail",
			want: false,
		},
		{
			name: "unterminated block comment",
			body: "/* placeholder",
			want: false,
		},
		{
			name: "SQL after LF line comment",
			body: "-- explanation\nSELECT 1;",
			want: true,
		},
		{
			name: "SQL after bare CR line comment",
			body: "-- explanation\rSELECT 1;",
			want: true,
		},
		{
			name: "SQL after block comment",
			body: "/* explanation */ SELECT 1;",
			want: true,
		},
		{
			name: "SQL after nested block comment",
			body: "/* outer /* inner */ outer */SELECT 1;",
			want: true,
		},
		{
			name: "comment marker inside SQL",
			body: "SELECT '-- not a comment-only body';",
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := containsMigrationSQL([]byte(tt.body)); got != tt.want {
				t.Fatalf("containsMigrationSQL(%q) = %t, want %t", tt.body, got, tt.want)
			}
		})
	}
}
