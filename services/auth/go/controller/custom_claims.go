package controller

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"reflect"
	"slices"
	"sort"
	"strings"

	"k8s.io/client-go/util/jsonpath"
)

func mergeMaps(map1, map2 map[string]any) map[string]any {
	result := make(map[string]any)

	maps.Copy(result, map1)

	for key, val := range map2 {
		if v, ok := result[key]; ok {
			switch t2 := v.(type) {
			case map[string]any:
				switch t1 := val.(type) {
				case map[string]any:
					result[key] = mergeMaps(t1, t2)
				case nil:
					result[key] = t2
				default:
					panic(fmt.Sprintf("cannot merge %v and %v", t2, val))
				}
			default:
				result[key] = val
			}
		} else {
			result[key] = val
		}
	}

	return result
}

func smartSplit(path string) []string {
	var (
		parts   []string
		current strings.Builder
	)

	bracketDepth := 0

	for _, char := range path {
		switch char {
		case '[':
			bracketDepth++

			current.WriteRune(char)
		case ']':
			bracketDepth--

			current.WriteRune(char)
		case '.':
			if bracketDepth == 0 {
				parts = append(parts, current.String())
				current.Reset()
			} else {
				current.WriteRune(char)
			}
		default:
			current.WriteRune(char)
		}
	}

	if current.Len() > 0 {
		parts = append(parts, current.String())
	}

	return parts
}

func extractFilterFields(filter string) []string { //nolint:cyclop,gocognit
	var fields []string
	// Extract fields from JSONPath filter expressions like [?(@.field == 'value')]
	if strings.Contains(filter, "[?") { //nolint:nestif
		// Find all @.fieldName patterns
		start := strings.Index(filter, "[?")
		if start != -1 {
			end := strings.Index(filter[start:], "]")
			if end != -1 {
				filterExpr := filter[start+2 : start+end] // Extract the filter expression
				// Look for @.fieldName patterns
				for i := 0; i < len(filterExpr); {
					atIndex := strings.Index(filterExpr[i:], "@.")
					if atIndex == -1 {
						break
					}

					atIndex += i
					fieldStart := atIndex + 2 //nolint:mnd
					fieldEnd := fieldStart
					// Find the end of the field name (stop at space, ), ==, !=, etc.)
					for fieldEnd < len(filterExpr) {
						char := filterExpr[fieldEnd]
						if char == ' ' || char == ')' || char == '=' || char == '!' ||
							char == '<' ||
							char == '>' {
							break
						}

						fieldEnd++
					}

					if fieldEnd > fieldStart {
						field := filterExpr[fieldStart:fieldEnd]
						// Only add if not already present
						found := false

						if slices.Contains(fields, field) {
							break
						}

						if !found {
							fields = append(fields, field)
						}
					}

					i = fieldEnd
				}
			}
		}
	}

	return fields
}

func parseClaims(parts []string) map[string]any {
	parts[0] = strings.Split(parts[0], "[")[0]
	switch len(parts) {
	case 1:
		if strings.HasSuffix(parts[0], "]") {
			return map[string]any{
				parts[0]: map[string]any{},
			}
		}

		return map[string]any{
			parts[0]: nil,
		}
	default:
		if parts[0] == "metadata" {
			return map[string]any{
				parts[0]: nil,
			}
		}

		return map[string]any{
			parts[0]: parseClaims(parts[1:]),
		}
	}
}

func claimsMapToGraphql(claims map[string]any) string {
	var result strings.Builder
	result.WriteString("{")

	// Sort the keys to ensure consistent order
	keys := make([]string, 0, len(claims))
	for k := range claims {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	for _, k := range keys {
		v := claims[k]
		switch t := v.(type) {
		case nil:
			result.WriteString(k + " ")
		case map[string]any:
			result.WriteString(k + "" + claimsMapToGraphql(t))
		default:
			panic(fmt.Sprintf("unexpected type %T", t))
		}
	}

	return result.String() + "}"
}

type RequestInterceptor func(*http.Request)

type jsonPath struct {
	path  string
	jpath *jsonpath.JSONPath
}

func (j jsonPath) IsArrary() bool {
	return strings.Contains(j.path, "[]") || strings.Contains(j.path, "[*]") ||
		strings.Contains(j.path, "[?")
}

type CustomClaims struct {
	graphqlQuery       string
	jsonPaths          map[string]jsonPath
	httpclient         *http.Client
	graphqlURL         string
	requestInterceptor []RequestInterceptor
	defaults           map[string]any
}

func CustomClaimerAddAdminSecret(adminSecret string) RequestInterceptor {
	return func(req *http.Request) {
		req.Header.Add("X-Hasura-Admin-Secret", adminSecret)
	}
}

func NewCustomClaims(
	rawClaims map[string]string,
	httpclient *http.Client,
	graphqlURL string,
	defaults map[string]any,
	requestInterceptor ...RequestInterceptor,
) (*CustomClaims, error) {
	claims := make(map[string]any)
	jsonPaths := make(map[string]jsonPath)

	for name, val := range rawClaims {
		parts := smartSplit(val)
		claims = mergeMaps(claims, parseClaims(parts))

		// Extract and add filter fields if this is a JSONPath filter expression
		if strings.Contains(val, "[?") { //nolint:nestif
			filterFields := extractFilterFields(val)
			if len(filterFields) > 0 {
				// Create a structure to add the filter fields to the appropriate location
				filterParts := smartSplit(val)
				if len(filterParts) > 0 {
					// Find the part with the filter and remove everything after the base field name
					baseParts := make([]string, 0, len(filterParts))
					for _, part := range filterParts {
						if strings.Contains(part, "[?") {
							// Extract just the field name before the filter
							basePart := strings.Split(part, "[")[0]
							baseParts = append(baseParts, basePart)

							break
						}

						baseParts = append(baseParts, part)
					}

					// Create claims for each filter field
					for _, field := range filterFields {
						claims = mergeMaps(claims, parseClaims(append(baseParts, field)))
					}
				}
			}
		}

		j := jsonpath.New(name)

		jpath := fmt.Sprintf("{ .%s }", strings.ReplaceAll(val, "[]", "[*]"))
		if err := j.Parse(jpath); err != nil {
			return nil, fmt.Errorf("failed to parse jsonpath for claim '%s': %w", name, err)
		}

		jsonPaths[name] = jsonPath{
			path:  val,
			jpath: j,
		}
	}

	query := fmt.Sprintf(
		"query GetClaims($id: uuid!) { user(id:$id) %s }",
		claimsMapToGraphql(claims),
	)

	return &CustomClaims{
		graphqlQuery:       query,
		jsonPaths:          jsonPaths,
		httpclient:         httpclient,
		graphqlURL:         graphqlURL,
		requestInterceptor: requestInterceptor,
		defaults:           defaults,
	}, nil
}

func (c *CustomClaims) GraphQLQuery() string {
	return c.graphqlQuery
}

func (c *CustomClaims) getClaimsBackwardsCompatibility(data any, path []string) any {
	if len(path) == 0 {
		return data
	}

	curPath := strings.TrimRight(path[0], "[]")

	value := reflect.ValueOf(data)
	switch value.Kind() { //nolint:exhaustive
	case reflect.Map:
		for _, key := range value.MapKeys() {
			if key.String() == curPath {
				return c.getClaimsBackwardsCompatibility(value.MapIndex(key).Interface(), path[1:])
			}
		}
	case reflect.Slice:
		got := make([]any, value.Len())
		for i := range value.Len() {
			got[i] = c.getClaimsBackwardsCompatibility(value.Index(i).Interface(), path)
		}

		return got
	default:
		// we should not reach here
	}

	return nil
}

func (c *CustomClaims) defaultOrNil(name string) any {
	if c.defaults != nil {
		if val, exists := c.defaults[name]; exists {
			return val
		}
	}

	return nil
}

func (c *CustomClaims) ExtractClaims(data any) (map[string]any, error) {
	claims := make(map[string]any)
	for name, j := range c.jsonPaths {
		var got any
		if strings.HasSuffix(j.path, "[]") {
			got = c.getClaimsBackwardsCompatibility(data, strings.Split(j.path, "."))
		} else {
			v, err := j.jpath.FindResults(data)
			if err != nil {
				claims[name] = c.defaultOrNil(name)
				continue
			}

			if j.IsArrary() {
				g := make([]any, len(v[0]))
				for i, r := range v[0] {
					g[i] = r.Interface()
				}

				got = g
			} else {
				got = v[0][0].Interface()
			}
		}

		if got == nil {
			claims[name] = c.defaultOrNil(name)
		} else {
			claims[name] = got
		}
	}

	return claims, nil
}

func (c *CustomClaims) makeRequest(ctx context.Context, userID string) (map[string]any, error) {
	buf := new(bytes.Buffer)
	if err := json.NewEncoder(buf).Encode(map[string]any{
		"query": c.graphqlQuery,
		"variables": map[string]any{
			"id": userID,
		},
	}); err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.graphqlURL, buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	for _, interceptor := range c.requestInterceptor {
		interceptor(req)
	}

	resp, err := c.httpclient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Encoding") == "gzip" {
		reader, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer reader.Close()

		resp.Body = reader
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)

		return nil, fmt.Errorf( //nolint:err113
			"unexpected status code (%d): %s",
			resp.StatusCode,
			body,
		)
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return data, nil
}

func (c *CustomClaims) GetClaims(ctx context.Context, userID string) (map[string]any, error) {
	data, err := c.makeRequest(ctx, userID)
	if err != nil {
		return nil, err
	}

	data, ok := data["data"].(map[string]any)
	if !ok {
		return nil, errors.New("failed to extract data from response") //nolint:err113
	}

	data, ok = data["user"].(map[string]any)
	if !ok {
		return nil, errors.New("failed to extract user data from response") //nolint:err113
	}

	return c.ExtractClaims(data)
}
