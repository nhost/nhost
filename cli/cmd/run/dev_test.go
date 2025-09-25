package run //nolint:testpackage

import "testing"

func TestEscape(t *testing.T) {
	t.Parallel()

	cases := []struct {
		s    string
		want string
	}{
		{
			s:    `#asdasd;l;kq23\\n40-0as9d"$\`,
			want: `#asdasd;l;kq23\\\\n40-0as9d\"\$\\`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.s, func(t *testing.T) {
			t.Parallel()

			if got := escape(tc.s); got != tc.want {
				t.Errorf("escape() = %v, want %v", got, tc.want)
			}
		})
	}
}
