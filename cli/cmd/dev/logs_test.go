package dev //nolint:testpackage

import "testing"

func TestShouldRunLogViewer(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		isTTY  bool
		follow bool
		want   bool
	}{
		{
			name:   "non-TTY without follow uses plain logs",
			isTTY:  false,
			follow: false,
			want:   false,
		},
		{
			name:   "non-TTY with follow uses plain logs",
			isTTY:  false,
			follow: true,
			want:   false,
		},
		{
			name:   "TTY without follow uses plain logs",
			isTTY:  true,
			follow: false,
			want:   false,
		},
		{
			name:   "TTY with follow opens log viewer",
			isTTY:  true,
			follow: true,
			want:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := shouldRunLogViewer(tc.isTTY, tc.follow)
			if got != tc.want {
				t.Errorf(
					"expected shouldRunLogViewer(%t, %t) = %t, got %t",
					tc.isTTY,
					tc.follow,
					tc.want,
					got,
				)
			}
		})
	}
}
