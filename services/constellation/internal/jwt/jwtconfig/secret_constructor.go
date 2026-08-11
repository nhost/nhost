package jwtconfig

// SecretOption customises a Secret produced by [NewStaticSecret] or
// [NewJWKSSecret]. Options are applied in order before the constructor invokes
// [Secret.Validate], so an option that sets a mutually-exclusive field (e.g.
// [WithClaimsMap] alongside [WithClaimsNamespace]) surfaces as a validation
// error from the constructor rather than at request time.
type SecretOption func(*Secret)

// WithKid sets the JWK key ID. Used by JWKS-backed secrets to disambiguate
// between multiple keys served by the same JWKS endpoint; harmless on static
// secrets.
func WithKid(kid string) SecretOption {
	return func(s *Secret) {
		s.Kid = kid
	}
}

// WithClaimsFormat sets the encoding of the Hasura claims namespace.
// Mutually exclusive with [WithClaimsMap].
func WithClaimsFormat(format ClaimsFormat) SecretOption {
	return func(s *Secret) {
		s.ClaimsFormat = format
	}
}

// WithClaimsNamespace sets the top-level JWT claim key under which Hasura
// session variables are nested. Mutually exclusive with
// [WithClaimsNamespacePath] and [WithClaimsMap].
func WithClaimsNamespace(namespace string) SecretOption {
	return func(s *Secret) {
		s.ClaimsNamespace = namespace
	}
}

// WithClaimsNamespacePath sets a dot-separated path into the JWT claims to
// locate the Hasura claims object. Mutually exclusive with
// [WithClaimsNamespace] and [WithClaimsMap].
func WithClaimsNamespacePath(path string) SecretOption {
	return func(s *Secret) {
		s.ClaimsNamespacePath = path
	}
}

// WithClaimsMap configures explicit per-variable claim mappings. Mutually
// exclusive with [WithClaimsNamespace], [WithClaimsNamespacePath], and
// [WithClaimsFormat]. Passing a nil or empty map is equivalent to omitting the
// option.
func WithClaimsMap(claimsMap ClaimsMap) SecretOption {
	return func(s *Secret) {
		s.ClaimsMap = claimsMap
	}
}

// WithAudience restricts accepted tokens to those whose `aud` claim matches
// one of the supplied values.
func WithAudience(audience ...string) SecretOption {
	return func(s *Secret) {
		s.Audience = StringOrList(audience)
	}
}

// WithIssuer restricts accepted tokens to those whose `iss` claim equals the
// supplied value.
func WithIssuer(issuer string) SecretOption {
	return func(s *Secret) {
		s.Issuer = issuer
	}
}

// WithAllowedSkew permits an expired token to validate when its expiry is no
// more than `skew` seconds in the past. Suitable for tolerating small clock
// drift between the JWT issuer and the verifier.
func WithAllowedSkew(skew uint) SecretOption {
	return func(s *Secret) {
		s.AllowedSkew = &skew
	}
}

// WithHeader overrides the default `Authorization: Bearer <token>` extraction
// strategy. The supplied [HeaderConfig] is validated as part of
// [Secret.Validate].
func WithHeader(h HeaderConfig) SecretOption {
	return func(s *Secret) {
		s.Header = &HeaderJSON{HeaderConfig: h}
	}
}

// NewStaticSecret constructs a Secret backed by a static signing key (HMAC or
// RSA public key, depending on alg) and runs [Secret.Validate] before
// returning. Use [NewJWKSSecret] for JWKS-URL-backed secrets.
//
// All optional fields — `kid`, `claims_*`, `audience`, `issuer`, `allowed_skew`,
// `header` — are supplied via [SecretOption]s; mutually exclusive options
// surface as validation errors from this constructor rather than at request
// time.
func NewStaticSecret(alg Algorithm, key string, opts ...SecretOption) (Secret, error) {
	s := Secret{
		Type:                alg,
		Key:                 key,
		Kid:                 "",
		JWKURL:              "",
		ClaimsFormat:        "",
		ClaimsNamespace:     "",
		ClaimsNamespacePath: "",
		ClaimsMap:           nil,
		Audience:            nil,
		Issuer:              "",
		AllowedSkew:         nil,
		Header:              nil,
	}

	for _, opt := range opts {
		opt(&s)
	}

	if err := s.Validate(); err != nil {
		return Secret{}, err
	}

	return s, nil
}

// NewJWKSSecret constructs a Secret backed by a JWKS URL and runs
// [Secret.Validate] before returning. Use [NewStaticSecret] for HMAC/RSA keys
// supplied inline.
//
// All optional fields — `kid`, `claims_*`, `audience`, `issuer`, `allowed_skew`,
// `header` — are supplied via [SecretOption]s; mutually exclusive options
// surface as validation errors from this constructor rather than at request
// time.
func NewJWKSSecret(url string, opts ...SecretOption) (Secret, error) {
	s := Secret{
		Type:                "",
		Key:                 "",
		Kid:                 "",
		JWKURL:              url,
		ClaimsFormat:        "",
		ClaimsNamespace:     "",
		ClaimsNamespacePath: "",
		ClaimsMap:           nil,
		Audience:            nil,
		Issuer:              "",
		AllowedSkew:         nil,
		Header:              nil,
	}

	for _, opt := range opts {
		opt(&s)
	}

	if err := s.Validate(); err != nil {
		return Secret{}, err
	}

	return s, nil
}
