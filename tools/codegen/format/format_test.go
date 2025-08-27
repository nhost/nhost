package format_test

import (
	"testing"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/stretchr/testify/assert"
)

func TestTitle(t *testing.T) {
	t.Parallel()

	cases := []struct {
		text string
		want string
	}{
		{
			text: "hello world",
			want: "Hello world",
		},
		{
			text: "hello-world",
			want: "Hello-world",
		},
		{
			text: "",
			want: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.text, func(t *testing.T) {
			t.Parallel()

			got := format.Title(tc.text)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestToCamelCase(t *testing.T) {
	t.Parallel()

	cases := []struct {
		text string
		want string
	}{
		{
			text: "hello world",
			want: "HelloWorld",
		},
		{
			text: "hello-world",
			want: "HelloWorld",
		},
		{
			text: "he-llo world",
			want: "HeLloWorld",
		},
		{
			text: "",
			want: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.text, func(t *testing.T) {
			t.Parallel()

			got := format.ToCamelCase(tc.text)
			assert.Equal(t, tc.want, got)
		})
	}
}
