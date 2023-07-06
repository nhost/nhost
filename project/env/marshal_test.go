package env_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/project/env"
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
      s1='v1' # comment
      s2='v2'#comments
      #more comments
      # more comments
      s3='v3'
      #s4='v4'
      s5='asd#qwe'
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
				&model.ConfigEnvironmentVariable{
					Name:  "s5",
					Value: "asd#qwe",
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

			cmpOpts := []cmp.Option{
				cmpopts.SortSlices(func(a, b *model.ConfigEnvironmentVariable) bool {
					return a.Name < b.Name
				}),
			}

			if diff := cmp.Diff(tc.expected, secrets, cmpOpts...); diff != "" {
				t.Error(diff)
			}
		})
	}
}
