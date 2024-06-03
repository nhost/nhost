package hibp_test

import (
	"context"
	"testing"

	"github.com/nhost/hasura-auth/go/hibp"
)

func TestIsPasswordPwned(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		password string
		isPwned  bool
	}{
		{
			name:     "p0wn3d",
			password: "password",
			isPwned:  true,
		},
		{
			name:     "s4f3",
			password: "asdkjq;34ou90pdsaojfcmnkelwnfvsodvyo324jrnklasjdlaksjd891273jl",
			isPwned:  false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			client := hibp.NewClient()
			pwned, err := client.IsPasswordPwned(context.Background(), tc.password)
			if err != nil {
				t.Errorf("error checking password: %v", err)
			}

			if pwned != tc.isPwned {
				t.Errorf("expected pwned: %v, got: %v", tc.isPwned, pwned)
			}
		})
	}
}
