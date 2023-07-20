package appconfig

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
)

func unptr[T any](t *T) T { //nolint:ireturn
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
	Value   *string `graphql:"value"   json:"value,omitempty"`
	Path    *string `graphql:"path"    json:"path,omitempty"`
	Default *string `graphql:"default" json:"default,omitempty"`
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

//nolint:tagliatelle
type jwtSecret struct {
	AllowedSkew         *uint32           `graphql:"allowed_skew"          json:"allowed_skew,omitempty"`
	Audience            *string           `graphql:"audience"              json:"audience,omitempty"`
	ClaimsMap           map[string]*claim `graphql:"claims_map"            json:"claims_map,omitempty"`
	ClaimsFormat        *string           `graphql:"claims_format"         json:"claims_format,omitempty"`
	ClaimsNamespace     *string           `graphql:"claims_namespace"      json:"claims_namespace,omitempty"`
	ClaimsNamespacePath *string           `graphql:"claims_namespace_path" json:"claims_namespace_path,omitempty"`
	Header              *string           `graphql:"header"                json:"header,omitempty"`
	Issuer              *string           `graphql:"issuer"                json:"issuer,omitempty"`
	JwkURL              *string           `graphql:"jwk_url"               json:"jwk_url,omitempty"`
	Key                 *string           `graphql:"key"                   json:"key,omitempty"`
	Type                *string           `graphql:"type"                  json:"type,omitempty"`
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
