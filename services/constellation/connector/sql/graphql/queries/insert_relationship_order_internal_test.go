package queries

import (
	"slices"
	"strings"
	"testing"

	"github.com/zeebo/xxh3"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestInsertRelationshipXXH3CReference(t *testing.T) {
	t.Parallel()

	// Generated with: cc -O2 -I<hashable-1.4.7.0> xxh.c -o xxh;
	// xxh.c uses XXH_INLINE_ALL and XXH3_64bits_withSeed(s,strlen(s),0)
	// from hashable-1.4.7.0/xxHash-0.8.2/xxhash.h. Literal expected
	// values are from that C implementation, never computed by Go in tests.
	tests := []struct {
		name  string
		value string
		want  uint64
	}{
		{"empty", "", 0x2d06800538d394c2},
		{"one", "a", 0xe6c632b61e964e1f},
		{"three", "abc", 0x78af5f94892f3950},
		{"four", "abcd", 0x6497a96f53a89890},
		{"eight", "abcdefgh", 0x6f45a76842a96483},
		{"nine", "abcdefghi", 0xe0dde4fc174590a0},
		{"sixteen", "abcdefghijklmnop", 0x3d3ccac9af14d8a8},
		{"seventeen", strings.Repeat("x", 17), 0x89975e6b7d2f5a11},
		{"128", strings.Repeat("x", 128), 0x4ca37e83f6cddd17},
		{"129", strings.Repeat("x", 129), 0xe4f9742108fe27dc},
		{"240", strings.Repeat("x", 240), 0x3e16ca8a0c6ccb68},
		{"241", strings.Repeat("x", 241), 0x14da9e5c301a6a1d},
		{"multiblock", strings.Repeat("x", 1025), 0x9cd2e05a61b8a761},
		{"utf8", "café", 0x4c83dbd5f29d367f},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := xxh3.HashString(tt.value); got != tt.want {
				t.Errorf("XXH3(%q) = %#x, want %#x", tt.value, got, tt.want)
			}
		})
	}
}

func TestSortedInsertRelationships(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input []string
		want  []string
	}{
		{
			"set A objects",
			[]string{"alpha_obj", "zulu_obj", "middle_obj"},
			[]string{"middle_obj", "alpha_obj", "zulu_obj"},
		},
		{
			"set A arrays",
			[]string{"zulu_arr", "alpha_arr", "middle_arr"},
			[]string{"alpha_arr", "middle_arr", "zulu_arr"},
		},
		{
			"set B objects",
			[]string{"cobalt_obj", "lima_obj", "tango_obj"},
			[]string{"tango_obj", "lima_obj", "cobalt_obj"},
		},
		{
			"set B arrays",
			[]string{"lima_arr", "tango_arr", "cobalt_arr"},
			[]string{"cobalt_arr", "tango_arr", "lima_arr"},
		},
		{
			"six arrays (fragment tie and numeric order disagreement)",
			[]string{
				"qa",
				"rel_arr_00000",
				"rel_000",
				"rel_arr_02120",
				"arr_mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm_00000",
				"arr_mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm_00088",
			},
			[]string{
				"arr_mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm_00000",
				"rel_arr_02120",
				"rel_arr_00000",
				"arr_mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm_00088",
				"qa",
				"rel_000",
			},
		},
		{
			"four objects and after-parent pair",
			[]string{"obj_rel_0002", "obj_rel_0000", "obj_rel_0224", "obj_rel_0001"},
			[]string{"obj_rel_0001", "obj_rel_0224", "obj_rel_0000", "obj_rel_0002"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			for _, reverse := range []bool{false, true} {
				input := slices.Clone(tt.input)
				if reverse {
					slices.Reverse(input)
				}

				nested := make([]arguments.NestedInsert, len(input))
				for i, name := range input {
					nested[i].RelationshipName = name
				}

				ordered := sortedInsertRelationships(nested)

				got := make([]string, len(ordered))
				for i, n := range ordered {
					got[i] = n.RelationshipName
				}

				if !slices.Equal(got, tt.want) {
					t.Errorf("reverse=%v: got %v, want %v", reverse, got, tt.want)
				}
			}
		})
	}
}
