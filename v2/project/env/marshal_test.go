package env_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/v2/project/env"
)

func TestUnmarshal(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		data     []byte
		expected model.Secrets
	}{
		{
			name: "success",
			data: []byte(`
      s1=v1 # comment
      s2=v2#comments
      #more comments
      # more comments
      s3=v3
      #s4=v4
      `),
			expected: model.Secrets{
				&model.ConfigEnvironmentVariable{
					Name:  "s1",
					Value: "v1",
				},
				&model.ConfigEnvironmentVariable{
					Name:  "s2",
					Value: "v2",
				},
				&model.ConfigEnvironmentVariable{
					Name:  "s3",
					Value: "v3",
				},
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			var secrets model.Secrets
			err := env.Unmarshal(tc.data, &secrets)
			if err != nil {
				t.Fatalf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, secrets); diff != "" {
				t.Error(diff)
			}
		})
	}
}
