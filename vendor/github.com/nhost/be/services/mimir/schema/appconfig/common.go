package appconfig

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
)

func unptr[T any](t *T) T { //nolint: ireturn
	if t == nil {
		return *new(T)
	}
	return *t
}

type EnvVar struct {
	Name       string
	Value      string
	SecretName string
	IsSecret   bool
}

func GetFQDN(subdomain, service, region, domain string) string {
	if region == "" {
		return fmt.Sprintf("%s.%s.%s", subdomain, service, domain)
	}
	return fmt.Sprintf("%s.%s.%s.%s", subdomain, service, region, domain)
}

func GetFQDNOld(subdomain, domain string) string {
	return fmt.Sprintf("%s.%s", subdomain, domain)
}

func Stringify(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	case bool:
		return fmt.Sprintf("%t", value)
	case int64, int32, int16, int8, uint64, uint32, uint16, uint8:
		return fmt.Sprintf("%d", value)
	case []string:
		return strings.Join(v, ",")
	default:
		return fmt.Sprintf("%v", v)
	}
}

type claim struct {
	Value   *string "json:\"value,omitempty\" graphql:\"value\""
	Path    *string "json:\"path,omitempty\" graphql:\"path\""
	Default *string "json:\"default,omitempty\" graphql:\"default\""
}

func (t *claim) MarshalJSON() ([]byte, error) {
	if t.Value != nil {
		return json.Marshal(t.Value) //nolint:wrapcheck
	}
	s := make(map[string]string)
	if t.Path != nil {
		s["path"] = *t.Path
	}
	if t.Default != nil {
		s["default"] = *t.Default
	}
	return json.Marshal(s) //nolint:wrapcheck
}

type jwtSecret struct {
	AllowedSkew         *uint32           "json:\"allowed_skew,omitempty\" graphql:\"allowed_skew\""
	Audience            *string           "json:\"audience,omitempty\" graphql:\"audience\""
	ClaimsMap           map[string]*claim "json:\"claims_map,omitempty\" graphql:\"claims_map\""
	ClaimsFormat        *string           "json:\"claims_format,omitempty\" graphql:\"claims_format\""
	ClaimsNamespace     *string           "json:\"claims_namespace,omitempty\" graphql:\"claims_namespace\""
	ClaimsNamespacePath *string           "json:\"claims_namespace_path,omitempty\" graphql:\"claims_namespace_path\""
	Header              *string           "json:\"header,omitempty\" graphql:\"header\""
	Issuer              *string           "json:\"issuer,omitempty\" graphql:\"issuer\""
	JwkURL              *string           "json:\"jwk_url,omitempty\" graphql:\"jwk_url\""
	Key                 *string           "json:\"key,omitempty\" graphql:\"key\""
	Type                *string           "json:\"type,omitempty\" graphql:\"type\""
}

func marshalJWT(jwt *model.ConfigJWTSecret) ([]byte, error) {
	var claimsMap map[string]*claim
	if jwt.ClaimsMap != nil {
		claimsMap = make(map[string]*claim, len(jwt.ClaimsMap))
		for _, v := range jwt.ClaimsMap {
			claimsMap[v.Claim] = &claim{
				Value:   v.Value,
				Path:    v.Path,
				Default: v.Default,
			}
		}
	}
	return json.Marshal(&jwtSecret{ //nolint:wrapcheck
		AllowedSkew:         jwt.AllowedSkew,
		Audience:            jwt.Audience,
		ClaimsMap:           claimsMap,
		ClaimsFormat:        jwt.ClaimsFormat,
		ClaimsNamespace:     jwt.ClaimsNamespace,
		ClaimsNamespacePath: jwt.ClaimsNamespacePath,
		Header:              jwt.Header,
		Issuer:              jwt.Issuer,
		JwkURL:              jwt.JwkUrl,
		Key:                 jwt.Key,
		Type:                jwt.Type,
	})
}
