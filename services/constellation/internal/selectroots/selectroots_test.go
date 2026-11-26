package selectroots_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/selectroots"
)

func TestDecode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		kind    selectroots.Kind
		value   any
		want    *[]string
		wantErr string
	}{
		{"null", selectroots.Query, nil, nil, ""},
		{"empty", selectroots.Subscription, []any{}, new([]string{}), ""},
		{
			"query operations", selectroots.Query,
			[]any{"select", "select_by_pk", "select_aggregate"},
			new([]string{"select", "select_by_pk", "select_aggregate"}), "",
		},
		{"string", selectroots.Query, "select", nil, "query_root_fields: expected a list"},
		{
			"map",
			selectroots.Subscription,
			map[string]any{},
			nil,
			"subscription_root_fields: expected a list",
		},
		{
			"null entry",
			selectroots.Query,
			[]any{"select", nil},
			nil,
			"query_root_fields[1]: expected an operation name string",
		},
		{
			"numeric entry",
			selectroots.Subscription,
			[]any{1.0},
			nil,
			"subscription_root_fields[0]: expected an operation name string",
		},
		{
			"query stream",
			selectroots.Query,
			[]any{"select_stream"},
			nil,
			`query_root_fields[0]: unknown root operation "select_stream"`,
		},
		{
			"subscription stream",
			selectroots.Subscription,
			[]any{"select_stream"},
			new([]string{"select_stream"}),
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := tt.kind.Decode(tt.value)
			if tt.wantErr != "" {
				if got != nil || err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf(
						"Decode(%v) = %v, %v; want nil and error containing %q",
						tt.value,
						got,
						err,
						tt.wantErr,
					)
				}

				return
			}

			if err != nil {
				t.Fatalf("Decode(%v): %v", tt.value, err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Decode(%v) (-want +got):\n%s", tt.value, diff)
			}
		})
	}
}

func TestValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		kind    selectroots.Kind
		fields  []string
		wantErr string
	}{
		{"nil", selectroots.Query, nil, ""},
		{"empty", selectroots.Subscription, []string{}, ""},
		{
			"typo",
			selectroots.Query,
			[]string{"select_by_pkk"},
			`query_root_fields[0]: unknown root operation "select_by_pkk"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.kind.Validate(tt.fields)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate(%v): %v", tt.fields, err)
				}

				return
			}

			if err == nil || err.Error() != tt.wantErr {
				t.Errorf("Validate(%v) = %v; want %q", tt.fields, err, tt.wantErr)
			}
		})
	}
}
