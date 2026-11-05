package customization_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestCustomizerTypeName(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name         string
		cfg          metadata.Customization
		native, want string
	}{
		{"prefix", metadata.Customization{TypeNamesPrefix: "League"}, "Team", "LeagueTeam"},
		{"suffix", metadata.Customization{TypeNamesSuffix: "X"}, "Team", "TeamX"},
		{"unknown", metadata.Customization{TypeNamesPrefix: "League"}, "Missing", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := customization.New(tc.cfg, customization.FlavorDatabase)
			c.Apply(newTestSchema())

			if got := c.TypeName(tc.native); got != tc.want {
				t.Errorf("TypeName=%q, want %q", got, tc.want)
			}
		})
	}
}
