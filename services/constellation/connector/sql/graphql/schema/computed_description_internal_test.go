package schema

import "testing"

func TestComputedDescriptionName(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		schema string
		want   string
	}{
		{schema: "public", want: "items"},
		{schema: "cf_select", want: "cf_select.items"},
	} {
		t.Run(tt.schema, func(t *testing.T) {
			t.Parallel()

			if got := computedDescriptionName(tt.schema, "items"); got != tt.want {
				t.Fatalf("description name = %q, want %q", got, tt.want)
			}
		})
	}
}
