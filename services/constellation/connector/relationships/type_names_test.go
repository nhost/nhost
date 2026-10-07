package relationships_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/relationships"
)

type decoratedTypeResolver struct {
	native     map[string]string
	customized map[string]string
}

func (r decoratedTypeResolver) GetTypeName(identifier string) string { return r.native[identifier] }
func (r decoratedTypeResolver) GetCustomizedTypeName(native string) string {
	return r.customized[native]
}

type nativeTypeResolver struct{ names map[string]string }

func (r nativeTypeResolver) GetTypeName(identifier string) string { return r.names[identifier] }

func TestSchemaTypeName(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name             string
		resolver         relationships.TypeNameResolver
		identifier, want string
	}{
		{"native", nativeTypeResolver{names: map[string]string{"public.kids": "kids"}}, "public.kids", "kids"},
		{"decorated", decoratedTypeResolver{native: map[string]string{"public.kids": "kids"}, customized: map[string]string{"kids": "Catalogkids"}}, "public.kids", "Catalogkids"},
		{"unknown identifier", decoratedTypeResolver{native: map[string]string{"public.kids": "kids"}, customized: map[string]string{"kids": "Catalogkids"}}, "public.other", ""},
		{"unknown native type", decoratedTypeResolver{native: map[string]string{"public.kids": "kids"}}, "public.kids", ""},
		{"missing connector", nil, "public.kids", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := relationships.SchemaTypeName(tc.resolver, tc.identifier); got != tc.want {
				t.Errorf("SchemaTypeName=%q, want %q", got, tc.want)
			}
		})
	}
}

func TestCustomizedTypeName(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name         string
		resolver     relationships.TypeNameResolver
		native, want string
	}{
		{"native derived", nativeTypeResolver{names: map[string]string{}}, "kids_aggregate", "kids_aggregate"},
		{"prefixed derived", decoratedTypeResolver{customized: map[string]string{"kids_aggregate": "Catalogkids_aggregate"}}, "kids_aggregate", "Catalogkids_aggregate"},
		{"suffixed derived", decoratedTypeResolver{customized: map[string]string{"kids_aggregate": "kids_aggregateX"}}, "kids_aggregate", "kids_aggregateX"},
		{"unknown", decoratedTypeResolver{}, "untracked", ""},
		{"empty", nativeTypeResolver{}, "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := relationships.CustomizedTypeName(tc.resolver, tc.native); got != tc.want {
				t.Errorf("CustomizedTypeName=%q, want %q", got, tc.want)
			}
		})
	}
}
