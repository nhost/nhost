package queries

import (
	"errors"
	"reflect"
	"testing"
)

func TestParseComputedPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		path    string
		want    []string
		invalid bool
	}{
		{path: "$", want: []string{}},
		{path: "status", want: []string{"status"}},
		{path: "$status", want: []string{"status"}},
		{path: "$.status", want: []string{"status"}},
		{path: `$.items[00]['a.b']`, want: []string{"items", "0", "a.b"}},
		{path: `$.[0]`, want: []string{"0"}},
		{path: `$. [0]`, invalid: true},
		{path: `a[0]b`, want: []string{"a", "0", "b"}},
		{path: `[0]a`, want: []string{"0", "a"}},
		{path: `["\u0073tatus"]`, want: []string{"status"}},
		{path: `['st\u0061tus']`, want: []string{"status"}},
		{path: `["\ud83d\ude00"]`, want: []string{"😀"}},
		{path: `['\ud83d\ude00']`, want: []string{"😀"}},
		{path: `["\ud83d"]`, invalid: true},
		{path: `['\ud83d']`, invalid: true},
		{path: `["\ude00"]`, invalid: true},
		{path: `['\ude00']`, invalid: true},
		{path: `["\ud83d\u0041"]`, invalid: true},
		{path: `['\ud83d\u0041']`, invalid: true},
		{path: `["\u0000"]`, want: []string{"\x00"}},
		{path: `['\u0000']`, want: []string{"\x00"}},
		{path: `["a\"b"]`, want: []string{`a"b`}},
		{path: `['a\'b']`, want: []string{`a'b`}},
		{path: `é_9-b`, want: []string{`é_9-b`}},
		{path: ``, invalid: true},
		{path: `$..x`, invalid: true},
		{path: `$.a[-1]`, invalid: true},
		{path: `$[not_index]`, invalid: true},
		{path: `$.a[`, invalid: true},
		{path: `$.a]`, invalid: true},
		{path: `$.a b`, invalid: true},
		{path: `1a`, invalid: true},
		{path: `a:b`, invalid: true},
		{path: `$.0`, invalid: true},
		{path: `-a`, invalid: true},
		{path: `a/b`, invalid: true},
		{path: `["st\atus"]`, invalid: true},
		{path: `['st\atus']`, invalid: true},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			t.Parallel()

			got, err := parseComputedPath(tt.path)
			if tt.invalid && !errors.Is(err, errInvalidComputedPath) ||
				!tt.invalid && (err != nil || !reflect.DeepEqual(got, tt.want)) {
				t.Fatalf(
					"parseComputedPath(%q) = %#v, %v; want %#v invalid=%v",
					tt.path,
					got,
					err,
					tt.want,
					tt.invalid,
				)
			}
		})
	}
}
