// Package jwtconfig owns the operator-facing configuration types for the JWT
// authenticator: the supported algorithms, claim/header taxonomies, the Secret
// struct, and the JSON parsing surface (including PEM-newline sanitisation and
// the array-or-object input forms produced by upstream configuration tooling).
//
// The consuming [jwt] package depends on these types to construct authenticators
// from validated configuration. External callers either obtain a [Config] via
// [ParseConfig] from raw JSON input, or build one literally for tests and
// programmatic configuration.
package jwtconfig

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strings"
)

// Sentinel errors for [Secret.Validate] and related configuration parsing.
var (
	ErrSecretMissingKeyOrJWKURL = errors.New(
		"jwt secret must have either type+key or jwk_url",
	)
	ErrSecretBothKeyAndJWKURL = errors.New(
		"jwt secret cannot have type or key with jwk_url",
	)
	ErrClaimsNamespaceConflict = errors.New(
		"jwt secret cannot have both claims_namespace and claims_namespace_path",
	)
	ErrClaimsMapNamespaceConflict = errors.New(
		"jwt secret cannot have both claims_map and claims_namespace",
	)
	ErrClaimsMapNamespacePathConflict = errors.New(
		"jwt secret cannot have both claims_map and claims_namespace_path",
	)
	ErrClaimsMapFormatConflict = errors.New(
		"jwt secret cannot have both claims_map and claims_format",
	)
	ErrInvalidClaimsFormat      = errors.New("invalid claims_format")
	ErrUnsupportedAlgorithm     = errors.New("unsupported algorithm")
	ErrCookieHeaderRequiresName = errors.New("cookie header type requires a name")
	ErrCustomHeaderRequiresName = errors.New("custom header type requires a name")
	ErrUnsupportedHeaderType    = errors.New("unsupported header type")
)

// Algorithm represents a JWT signing algorithm. The supported set is defined
// by the Algorithm* constants; any other value is rejected by [Secret.Validate].
type Algorithm string

// Supported JWT signing algorithms. HS* are HMAC over a shared secret; RS* are
// RSA with a PEM-encoded public key.
const (
	// AlgorithmHS256 is HMAC-SHA256 over a shared symmetric key.
	AlgorithmHS256 Algorithm = "HS256"
	// AlgorithmHS384 is HMAC-SHA384 over a shared symmetric key.
	AlgorithmHS384 Algorithm = "HS384"
	// AlgorithmHS512 is HMAC-SHA512 over a shared symmetric key.
	AlgorithmHS512 Algorithm = "HS512"
	// AlgorithmRS256 is RSASSA-PKCS1-v1_5 with SHA-256 and a PEM-encoded public key.
	AlgorithmRS256 Algorithm = "RS256"
	// AlgorithmRS384 is RSASSA-PKCS1-v1_5 with SHA-384 and a PEM-encoded public key.
	AlgorithmRS384 Algorithm = "RS384"
	// AlgorithmRS512 is RSASSA-PKCS1-v1_5 with SHA-512 and a PEM-encoded public key.
	AlgorithmRS512 Algorithm = "RS512"
)

// ClaimsFormat describes how Hasura claims are encoded in the JWT.
type ClaimsFormat string

// Supported claims encodings. JSON is the default: the Hasura namespace claim
// is a JSON object. StringifiedJSON treats the claim as a JSON string that
// must be parsed before lookup.
const (
	// ClaimsFormatJSON treats the Hasura namespace claim as a native JSON object.
	ClaimsFormatJSON ClaimsFormat = "json"
	// ClaimsFormatStringifiedJSON treats the Hasura namespace claim as a JSON
	// string that must be parsed before lookup. Compatible with Hasura's
	// "stringified_json" mode.
	ClaimsFormatStringifiedJSON ClaimsFormat = "stringified_json"
)

// HeaderType describes where the JWT token is sourced from.
type HeaderType string

// Where the JWT token is sourced from on the incoming request.
// Authorization reads the standard `Authorization: Bearer <token>` header.
// Cookie reads a named cookie. CustomHeader reads a named header verbatim.
const (
	// HeaderTypeAuthorization extracts the token from the standard
	// `Authorization: Bearer <token>` header. The Name field of [HeaderConfig]
	// is unused for this type.
	HeaderTypeAuthorization HeaderType = "Authorization"
	// HeaderTypeCookie extracts the token from the cookie named by
	// [HeaderConfig.Name].
	HeaderTypeCookie HeaderType = "Cookie"
	// HeaderTypeCustomHeader extracts the token verbatim from the HTTP header
	// named by [HeaderConfig.Name].
	HeaderTypeCustomHeader HeaderType = "CustomHeader"
)

// HeaderConfig describes how to extract the JWT from an HTTP request.
type HeaderConfig struct {
	// Type selects the extraction strategy.
	Type HeaderType `json:"type"`
	// Name is the cookie or header name. Unused when Type is Authorization.
	Name string `json:"name"`
}

// DefaultClaimsNamespace is the Hasura-compatible default JWT claim key under
// which session variables are expected when no namespace or namespace_path is
// configured.
const DefaultClaimsNamespace = "https://hasura.io/jwt/claims"

// ClaimsMap maps individual session variables to JWT claim locations or literal values.
type ClaimsMap map[string]ClaimsMapEntry

// ClaimsMapEntry represents a single entry in a claims_map.
// Exactly one of (Path, Literal) is set at a time: Path navigates the JWT
// claims and Literal returns a fixed value. Default is consulted only when
// Path is set and the lookup fails — if Default is nil, the missing-path
// error propagates.
type ClaimsMapEntry struct {
	// Path is a dot-separated path into the JWT claims (e.g. "$.user.role").
	Path string `json:"path,omitempty"`
	// Default is returned when Path lookup fails. Ignored if Literal is set.
	Default any `json:"default,omitempty"`
	// Literal is a fixed value used in place of a Path lookup. Populated by
	// UnmarshalJSON when the JSON value is not a `{path, default}` object.
	Literal any `json:"-"`
}

// UnmarshalJSON decodes a claims_map entry from either a path-object form
// (`{"path": "...", "default": ...}`) or a bare literal value.
func (e *ClaimsMapEntry) UnmarshalJSON(data []byte) error {
	// Try as path object first: {"path": "$.some.path", "default": "value"}
	type pathObj struct {
		Path    string `json:"path"`
		Default any    `json:"default,omitempty"`
	}

	var obj pathObj
	if err := json.Unmarshal(data, &obj); err == nil && obj.Path != "" {
		e.Path = obj.Path
		e.Default = obj.Default

		return nil
	}

	// Fall back to literal value (string, array, number, etc.)
	var literal any
	if err := json.Unmarshal(data, &literal); err != nil {
		return fmt.Errorf("claims_map entry must be a path object or a literal value: %w", err)
	}

	e.Literal = literal

	return nil
}

// Secret configures a single JWT validation source. Maps 1:1 to the #Secret
// Cue schema in nhost.toml.
//
// Exactly one of (Type+Key) or JWKURL must be set, never both — Type+Key is
// a static HMAC/RSA key, JWKURL fetches keys from a remote JWKS endpoint.
// At most one of ClaimsNamespace / ClaimsNamespacePath / ClaimsMap may be set;
// see [Secret.Validate] for the full mutual-exclusion rules. Prefer
// [NewStaticSecret] or [NewJWKSSecret] over literal construction — both
// constructors run [Secret.Validate] before returning, surfacing
// misconfiguration at construction time rather than at first request.
type Secret struct {
	// Type names the signing algorithm. Required when using a static key
	// (Type+Key form); omit when using JWKURL.
	Type Algorithm `json:"type,omitempty"`
	// Key is the signing key material for the static form: the raw shared
	// secret, used as its UTF-8 bytes to match Hasura/Nhost Auth, for HS*, or a
	// PEM-encoded RSA public key for RS*. Required when Type is set; omit when
	// using JWKURL.
	Key string `json:"key,omitempty"`
	// Kid pins validation to a specific key ID. Optional; when set, JWTs
	// without a matching `kid` header are rejected. Applies to both JWKURL
	// secrets and static RSA keys.
	Kid string `json:"kid,omitempty"`
	// JWKURL is the JWKS endpoint to fetch signing keys from. Mutually
	// exclusive with Type and Key. Required when not using a static key.
	JWKURL string `json:"jwk_url,omitempty"`
	// ClaimsFormat selects how the Hasura claims object is encoded inside the
	// JWT. Defaults to [ClaimsFormatJSON]. Mutually exclusive with ClaimsMap.
	ClaimsFormat ClaimsFormat `json:"claims_format,omitempty"`
	// ClaimsNamespace overrides the JWT claim key under which Hasura session
	// variables are located. Defaults to [DefaultClaimsNamespace]. Mutually
	// exclusive with ClaimsNamespacePath and ClaimsMap.
	ClaimsNamespace string `json:"claims_namespace,omitempty"`
	// ClaimsNamespacePath is a dot-separated JSON path (optionally `$`-prefixed)
	// to the Hasura claims object inside the JWT. Mutually exclusive with
	// ClaimsNamespace and ClaimsMap.
	ClaimsNamespacePath string `json:"claims_namespace_path,omitempty"`
	// ClaimsMap maps individual session variables to JWT claim locations or
	// literal values. Mutually exclusive with ClaimsNamespace,
	// ClaimsNamespacePath, and ClaimsFormat.
	ClaimsMap ClaimsMap `json:"claims_map,omitempty"`
	// Audience restricts validation to JWTs whose `aud` claim contains one of
	// these values. Accepts a single string or a list of strings in JSON.
	// Empty means any audience is accepted.
	Audience StringOrList `json:"audience,omitempty"`
	// Issuer restricts validation to JWTs whose `iss` claim equals this value.
	// Empty means any issuer is accepted.
	Issuer string `json:"issuer,omitempty"`
	// AllowedSkew is the maximum clock-skew tolerance in seconds for
	// time-based claims (exp, nbf, iat). nil disables leeway. Bounded above
	// by math.MaxInt64 when converted to time.Duration internally.
	AllowedSkew *uint `json:"allowed_skew,omitempty"`
	// Header selects where the JWT is read from on the incoming HTTP request.
	// When nil, defaults to the standard `Authorization: Bearer <token>` header.
	Header *HeaderJSON `json:"header,omitempty"`
}

// StringOrList handles JSON fields that can be either a string or a list of strings.
type StringOrList []string

// UnmarshalJSON decodes a JSON value that may be either a single string or a
// list of strings into a slice.
func (s *StringOrList) UnmarshalJSON(data []byte) error {
	var single string
	if err := json.Unmarshal(data, &single); err == nil {
		*s = []string{single}
		return nil
	}

	var list []string
	if err := json.Unmarshal(data, &list); err != nil {
		return fmt.Errorf("audience must be a string or list of strings: %w", err)
	}

	*s = list

	return nil
}

// HeaderJSON handles the `header` field which is a JSON string in the Cue schema.
type HeaderJSON struct {
	HeaderConfig
}

// UnmarshalJSON decodes the header configuration from either a JSON-encoded
// string (matching Hasura's stringified form) or a nested JSON object.
func (h *HeaderJSON) UnmarshalJSON(data []byte) error {
	// The header field can be a JSON string containing a JSON object,
	// or a direct JSON object.
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		if err := json.Unmarshal([]byte(str), &h.HeaderConfig); err != nil {
			return fmt.Errorf("failed to parse header config from string: %w", err)
		}

		return nil
	}

	if err := json.Unmarshal(data, &h.HeaderConfig); err != nil {
		return fmt.Errorf("failed to parse header config: %w", err)
	}

	return nil
}

// EffectiveHeaderConfig returns the configured header extraction settings,
// defaulting to the standard `Authorization: Bearer <token>` strategy when
// the secret leaves Header unset.
func (s *Secret) EffectiveHeaderConfig() HeaderConfig {
	if s.Header != nil {
		return s.Header.HeaderConfig
	}

	return HeaderConfig{
		Type: HeaderTypeAuthorization,
		Name: "Authorization",
	}
}

// EffectiveClaimsNamespace returns the configured claims namespace, falling
// back to [DefaultClaimsNamespace] when ClaimsNamespace is empty.
func (s *Secret) EffectiveClaimsNamespace() string {
	if s.ClaimsNamespace != "" {
		return s.ClaimsNamespace
	}

	return DefaultClaimsNamespace
}

// EffectiveClaimsFormat returns the configured claims format, defaulting to
// [ClaimsFormatJSON] when ClaimsFormat is empty.
func (s *Secret) EffectiveClaimsFormat() ClaimsFormat {
	if s.ClaimsFormat != "" {
		return s.ClaimsFormat
	}

	return ClaimsFormatJSON
}

// Validate enforces mutual exclusions and required fields.
func (s *Secret) Validate() error {
	hasType := s.Type != ""
	hasKey := s.Key != ""
	hasJWKURL := s.JWKURL != ""

	if hasJWKURL && (hasType || hasKey) {
		return ErrSecretBothKeyAndJWKURL
	}

	if !hasJWKURL && (!hasType || !hasKey) {
		return ErrSecretMissingKeyOrJWKURL
	}

	if hasType {
		if err := validateAlgorithm(s.Type); err != nil {
			return err
		}
	}

	if err := s.validateClaimsConfig(); err != nil {
		return err
	}

	if s.Header != nil {
		if err := validateHeaderConfig(s.Header.HeaderConfig); err != nil {
			return err
		}
	}

	return nil
}

func (s *Secret) validateClaimsConfig() error {
	if s.ClaimsNamespace != "" && s.ClaimsNamespacePath != "" {
		return ErrClaimsNamespaceConflict
	}

	if len(s.ClaimsMap) > 0 {
		if s.ClaimsNamespace != "" {
			return ErrClaimsMapNamespaceConflict
		}

		if s.ClaimsNamespacePath != "" {
			return ErrClaimsMapNamespacePathConflict
		}

		if s.ClaimsFormat != "" {
			return ErrClaimsMapFormatConflict
		}
	}

	if s.ClaimsFormat != "" && s.ClaimsFormat != ClaimsFormatJSON &&
		s.ClaimsFormat != ClaimsFormatStringifiedJSON {
		return fmt.Errorf("%w: %s", ErrInvalidClaimsFormat, s.ClaimsFormat)
	}

	return nil
}

func validateAlgorithm(alg Algorithm) error {
	switch alg {
	case AlgorithmHS256, AlgorithmHS384, AlgorithmHS512,
		AlgorithmRS256, AlgorithmRS384, AlgorithmRS512:
		return nil
	default:
		return fmt.Errorf("%w: %s", ErrUnsupportedAlgorithm, alg)
	}
}

func validateHeaderConfig(h HeaderConfig) error {
	switch h.Type {
	case HeaderTypeAuthorization:
		return nil
	case HeaderTypeCookie:
		if h.Name == "" {
			return ErrCookieHeaderRequiresName
		}

		return nil
	case HeaderTypeCustomHeader:
		if h.Name == "" {
			return ErrCustomHeaderRequiresName
		}

		return nil
	default:
		return fmt.Errorf("%w: %s", ErrUnsupportedHeaderType, h.Type)
	}
}

// Config holds the JWT authentication configuration.
//
// External callers may either construct a Config literal directly
// (`jwtconfig.Config{Secrets: []jwtconfig.Secret{...}}`) or obtain one through
// [ParseConfig]. Both forms are supported and behave identically when passed
// to the JWT authenticator: per-secret [Secret.Validate] is invoked during
// authenticator construction, so an invalid hand-built Config surfaces the
// same error as one produced from raw JSON. ParseConfig additionally handles
// PEM-newline sanitisation, array-vs-object input, and pre-validates each
// secret before returning; choose it when the source is operator-provided
// JSON, and use literal construction when the values are already typed
// (tests, in-process configuration, programmatic callers).
type Config struct {
	// Secrets is the ordered list of JWT secret configurations. Each request
	// is tried against every entry in order until one validates the token or
	// all fail. May be constructed literally; see the Config godoc.
	Secrets []Secret
}

// ParseConfig parses JWT secret JSON strings into a Config.
// Each string can be a single JSON object or a JSON array.
func ParseConfig(raw []string) (Config, error) {
	var secrets []Secret

	for _, s := range raw {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}

		parsed, err := parseSecretJSON(s)
		if err != nil {
			return Config{}, fmt.Errorf("failed to parse jwt secret: %w", err)
		}

		secrets = append(secrets, parsed...)
	}

	for i := range secrets {
		if err := secrets[i].Validate(); err != nil {
			return Config{}, fmt.Errorf("invalid jwt secret at index %d: %w", i, err)
		}
	}

	return Config{Secrets: secrets}, nil
}

func parseSecretJSON(s string) ([]Secret, error) {
	secrets, rawErr := unmarshalSecrets(s)
	if rawErr != nil {
		// Literal newlines inside JSON string values (from TOML-rendered PEM keys)
		// make the JSON invalid. Escape them to preserve newline positions in the key.
		sanitized := strings.ReplaceAll(s, "\n", "\\n")

		var sanitisedErr error

		secrets, sanitisedErr = unmarshalSecrets(sanitized)
		if sanitisedErr != nil {
			// Surface both attempts so an operator can see why the literal form failed
			// when the newline-sanitised retry also fails.
			return nil, fmt.Errorf(
				"parsing jwt secret (raw=%w, sanitised=%w)",
				rawErr,
				sanitisedErr,
			)
		}
	}

	// Normalize literal \n sequences to actual newlines (common when PEM keys
	// are passed through environment variables or config files as single-line values).
	for i := range secrets {
		secrets[i].Key = strings.ReplaceAll(secrets[i].Key, `\n`, "\n")
	}

	return secrets, nil
}

func unmarshalSecrets(s string) ([]Secret, error) {
	// Try as array first.
	var arr []Secret

	arrErr := json.Unmarshal([]byte(s), &arr)
	if arrErr == nil {
		return arr, nil
	}

	// Try as single object.
	var single Secret
	if err := json.Unmarshal([]byte(s), &single); err != nil {
		// Surface both attempts so an operator can see why the array form failed
		// when the single-object retry also fails.
		return nil, fmt.Errorf("invalid JSON (array=%w, object=%w)", arrErr, err)
	}

	return []Secret{single}, nil
}
