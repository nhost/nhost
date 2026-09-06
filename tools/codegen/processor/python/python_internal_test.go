package python

import "testing"

func TestToSnakeCase(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "camel case", input: "camelCase", want: "camel_case"},
		{name: "kebab case", input: "kebab-case", want: "kebab_case"},
		{name: "dotted", input: "profile.name", want: "profile_name"},
		{name: "acronym run", input: "clientDataJSON", want: "client_data_json"},
		{name: "leading acronym", input: "JSONClientData", want: "json_client_data"},
		{name: "multipart array suffix", input: "files[]", want: "files"},
		{name: "leading digit", input: "2faMethod", want: "2fa_method"},
		{name: "punctuation only", input: "[]", want: ""},
		{name: "empty", input: "", want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := toSnakeCase(test.input); got != test.want {
				t.Errorf("toSnakeCase(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestUnderscoreBeforeUpper(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		index int
		want  bool
	}{
		{name: "initial uppercase", input: "Client", index: 0, want: false},
		{name: "after lowercase", input: "clientData", index: 6, want: true},
		{name: "after digit", input: "v2Client", index: 2, want: true},
		{name: "inside acronym", input: "JSON", index: 2, want: false},
		{name: "end of acronym before word", input: "JSONData", index: 4, want: true},
		{name: "after separator", input: "client-Data", index: 7, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := underscoreBeforeUpper([]rune(test.input), test.index); got != test.want {
				t.Errorf(
					"underscoreBeforeUpper(%q, %d) = %t, want %t",
					test.input,
					test.index,
					got,
					test.want,
				)
			}
		})
	}
}

func TestSafeIdentifier(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: "field"},
		{name: "leading digit", input: "2fa", want: "field_2fa"},
		{name: "hard keyword", input: "class", want: "class_"},
		{name: "soft keyword type", input: "type", want: "type"},
		{name: "soft keyword match", input: "match", want: "match"},
		{name: "soft keyword case", input: "case", want: "case"},
		{name: "pydantic protected prefix", input: "model_dump", want: "model_dump_"},
		{name: "ordinary identifier", input: "display_name", want: "display_name"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := safeIdentifier(test.input); got != test.want {
				t.Errorf("safeIdentifier(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestFieldDefinition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		fieldName   string
		rawName     string
		typeName    string
		description string
		optional    bool
		missable    bool
		sensitive   bool
		want        string
	}{
		{
			name:      "required plain field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			want:      "name: str",
		},
		{
			name:      "nullable required field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			optional:  true,
			want:      "name: str | None",
		},
		{
			name:      "missable field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			optional:  true,
			missable:  true,
			want:      "name: str | None = None",
		},
		{
			name:      "aliased missable field",
			fieldName: "display_name",
			rawName:   "displayName",
			typeName:  "str",
			optional:  true,
			missable:  true,
			want: "display_name: str | None = Field(default=None, " +
				`alias="displayName")`,
		},
		{
			name:      "sensitive alias is redacted",
			fieldName: "access_token",
			rawName:   "accessToken",
			typeName:  "str",
			sensitive: true,
			want:      `access_token: str = Field(alias="accessToken", repr=False)`,
		},
		{
			name:        "documented field",
			fieldName:   "name",
			rawName:     "name",
			typeName:    "str",
			description: "Display name.",
			want: "name: str = Field(\n" +
				`        description="Display name.",` + "\n" +
				"    )",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := fieldDefinition(
				test.fieldName,
				test.rawName,
				test.typeName,
				test.description,
				test.optional,
				test.missable,
				test.sensitive,
			)
			if got != test.want {
				t.Errorf("fieldDefinition() = %q, want %q", got, test.want)
			}
		})
	}
}
