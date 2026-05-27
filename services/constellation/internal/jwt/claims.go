package jwt

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// sessionVariablePrefix is the case-insensitive prefix every claim must carry
// to be exposed as a Hasura session variable. Permission filters and remote
// schema presets look up session variables by lowercased keys with this
// prefix, so unprefixed claims are intentionally dropped.
const sessionVariablePrefix = "x-hasura-"

// Sentinel errors for claims extraction and Hasura session-variable validation.
var (
	ErrClaimsNamespaceNotFound = errors.New("claims namespace not found in token")
	ErrClaimsPathSegment       = errors.New("invalid path segment")
	ErrClaimsKeyNotFound       = errors.New("key not found")
	ErrClaimsStringifiedJSON   = errors.New(
		"claims_format is stringified_json but claims value is not a string",
	)
	ErrClaimsExpectedObject    = errors.New("expected object for claims")
	ErrClaimsUnsupportedFormat = errors.New("unsupported claims format")
	ErrAllowedRolesRequired    = errors.New("x-hasura-allowed-roles claim is required")
	ErrDefaultRoleRequired     = errors.New("x-hasura-default-role claim is required")
	ErrDefaultRoleMustBeString = errors.New("x-hasura-default-role must be a string")
	ErrRoleNotAllowed          = errors.New("role is not in x-hasura-allowed-roles")
	ErrClaimsMustBeArray       = errors.New("must be an array")
	ErrClaimsElementNotString  = errors.New("element is not a string")
)

// claimsExtractor extracts Hasura claims from JWT claims.
type claimsExtractor struct {
	namespace     string
	namespacePath string
	format        jwtconfig.ClaimsFormat
	claimsMap     jwtconfig.ClaimsMap
}

func newClaimsExtractor(
	namespace, namespacePath string,
	format jwtconfig.ClaimsFormat,
	claimsMap jwtconfig.ClaimsMap,
) claimsExtractor {
	return claimsExtractor{
		namespace:     namespace,
		namespacePath: namespacePath,
		format:        format,
		claimsMap:     claimsMap,
	}
}

func (ce claimsExtractor) extractClaims(claims map[string]any) (map[string]any, error) {
	if len(ce.claimsMap) > 0 {
		return ce.extractClaimsFromMap(claims)
	}

	var raw any

	if ce.namespacePath != "" {
		var err error

		raw, err = navigatePath(claims, ce.namespacePath)
		if err != nil {
			return nil, fmt.Errorf("navigating claims_namespace_path %q: %w", ce.namespacePath, err)
		}
	} else {
		ns := ce.namespace
		if ns == "" {
			ns = jwtconfig.DefaultClaimsNamespace
		}

		var ok bool

		raw, ok = claims[ns]
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrClaimsNamespaceNotFound, ns)
		}
	}

	return parseClaims(raw, ce.format)
}

// extractClaimsFromMap resolves each claims_map entry against the JWT claims.
func (ce claimsExtractor) extractClaimsFromMap(claims map[string]any) (map[string]any, error) {
	result := make(map[string]any, len(ce.claimsMap))

	for key, entry := range ce.claimsMap {
		val, err := resolveClaimsMapEntry(claims, entry)
		if err != nil {
			return nil, fmt.Errorf("claims_map key %q: %w", key, err)
		}

		result[key] = val
	}

	return result, nil
}

func resolveClaimsMapEntry(claims map[string]any, entry jwtconfig.ClaimsMapEntry) (any, error) {
	if entry.Literal != nil {
		return entry.Literal, nil
	}

	val, err := navigatePath(claims, entry.Path)
	if err != nil {
		if entry.Default != nil {
			return entry.Default, nil
		}

		return nil, fmt.Errorf("path %q: %w", entry.Path, err)
	}

	return val, nil
}

// navigatePath follows a dot-separated path through nested maps.
// Supports paths like "$.hasura.claims" or "hasura.claims".
func navigatePath(data map[string]any, path string) (any, error) {
	// Strip leading "$." prefix if present.
	path = strings.TrimPrefix(path, "$.")
	path = strings.TrimPrefix(path, "$")

	segments := strings.Split(path, ".")

	var current any = data

	for _, seg := range segments {
		if seg == "" {
			continue
		}

		m, ok := current.(map[string]any)
		if !ok {
			return nil, fmt.Errorf(
				"%w: expected object at path segment %q, got %T",
				ErrClaimsPathSegment, seg, current,
			)
		}

		current, ok = m[seg]
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrClaimsKeyNotFound, seg)
		}
	}

	return current, nil
}

// parseClaims handles json vs stringified_json format.
func parseClaims(raw any, format jwtconfig.ClaimsFormat) (map[string]any, error) {
	switch format {
	case jwtconfig.ClaimsFormatStringifiedJSON:
		str, ok := raw.(string)
		if !ok {
			return nil, fmt.Errorf("%w: got %T", ErrClaimsStringifiedJSON, raw)
		}

		var result map[string]any
		if err := json.Unmarshal([]byte(str), &result); err != nil {
			return nil, fmt.Errorf("failed to parse stringified claims JSON: %w", err)
		}

		return result, nil

	case jwtconfig.ClaimsFormatJSON, "":
		m, ok := raw.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%w: got %T", ErrClaimsExpectedObject, raw)
		}

		return m, nil

	default:
		return nil, fmt.Errorf("%w: %s", ErrClaimsUnsupportedFormat, format)
	}
}

// buildSessionVariables validates Hasura claims and builds session variables.
// It returns the effective role, session variables map, and any error.
func buildSessionVariables(
	claims map[string]any,
	roleOverride string,
) (string, map[string]any, error) {
	allowedRolesRaw, ok := claims["x-hasura-allowed-roles"]
	if !ok {
		return "", nil, ErrAllowedRolesRequired
	}

	allowedRoles, err := toStringSlice(allowedRolesRaw)
	if err != nil {
		return "", nil, fmt.Errorf("x-hasura-allowed-roles: %w", err)
	}

	defaultRoleRaw, ok := claims["x-hasura-default-role"]
	if !ok {
		return "", nil, ErrDefaultRoleRequired
	}

	defaultRole, ok := defaultRoleRaw.(string)
	if !ok {
		return "", nil, ErrDefaultRoleMustBeString
	}

	role := defaultRole
	if roleOverride != "" {
		if !slices.Contains(allowedRoles, roleOverride) {
			return "", nil, fmt.Errorf(
				"%w: role %q not in %v",
				ErrRoleNotAllowed, roleOverride, allowedRoles,
			)
		}

		role = roleOverride
	}

	// Copy only x-hasura-* claims (case-insensitive) into the session
	// variables map, lowercasing each key. Other claims are dropped: the
	// downstream permission engine and remote-schema preset resolver both look
	// up session variables by lowercased x-hasura-* keys
	// (connector/sql/graphql/queries/permissions and
	// connector/remoteschema/execute), so non-prefixed claims would be unused
	// while still widening the surface a JWT issuer can influence.
	variables := make(map[string]any, len(claims))

	for k, v := range claims {
		lk := strings.ToLower(k)
		if !strings.HasPrefix(lk, sessionVariablePrefix) {
			continue
		}

		variables[lk] = v
	}

	variables["x-hasura-role"] = role

	return role, variables, nil
}

func toStringSlice(v any) ([]string, error) {
	arr, ok := v.([]any)
	if !ok {
		return nil, ErrClaimsMustBeArray
	}

	result := make([]string, len(arr))

	for i, item := range arr {
		s, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("%w: element %d", ErrClaimsElementNotString, i)
		}

		result[i] = s
	}

	return result, nil
}
