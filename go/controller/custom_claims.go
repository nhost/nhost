package controller

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"k8s.io/client-go/util/jsonpath"
)

func mergeMaps(map1, map2 map[string]any) map[string]any {
	result := make(map[string]any)

	for key, val := range map1 {
		result[key] = val
	}

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
	result := "{"

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
			result += k + " "
		case map[string]any:
			result += k + "" + claimsMapToGraphql(t)
		default:
			panic(fmt.Sprintf("unexpected type %T", t))
		}
	}
	return result + "}"
}

type RequestInterceptor func(*http.Request)

type CustomClaims struct {
	graphqlQuery       string
	jsonPaths          map[string]*jsonpath.JSONPath
	httpclient         *http.Client
	graphqlURL         string
	requestInterceptor []RequestInterceptor
}

func CustomClaimerAddAdminSecret(adminSecret string) RequestInterceptor {
	return func(req *http.Request) {
		req.Header.Add("x-hasura-admin-secret", adminSecret)
	}
}

func NewCustomClaims(
	claimsString string,
	httpclient *http.Client,
	graphqlURL string,
	requestInterceptor ...RequestInterceptor,
) (*CustomClaims, error) {
	var raw map[string]string
	if err := json.Unmarshal([]byte(claimsString), &raw); err != nil {
		return nil, fmt.Errorf("failed to unmarshal custom claims: %w", err)
	}

	claims := make(map[string]any)
	jsonPaths := make(map[string]*jsonpath.JSONPath)
	for name, val := range raw {
		parts := strings.Split(val, ".")
		claims = mergeMaps(claims, parseClaims(parts))

		j := jsonpath.New(name)
		jpath := fmt.Sprintf("{ .%s }", strings.ReplaceAll(val, "[]", "[*]"))
		if err := j.Parse(jpath); err != nil {
			return nil, fmt.Errorf("failed to parse jsonpath for claim '%s': %w", name, err)
		}
		jsonPaths[name] = j
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
	}, nil
}

func (c *CustomClaims) GraphQLQuery() string {
	return c.graphqlQuery
}

func (c *CustomClaims) ExtractClaims(data any) (map[string]any, error) {
	claims := make(map[string]any)
	for name, j := range c.jsonPaths {
		v, err := j.FindResults(data)
		if err != nil {
			claims[name] = nil
			continue
		}

		var got any
		if len(v[0]) == 1 {
			got = v[0][0].Interface()
		} else {
			g := make([]any, len(v[0]))
			for i, r := range v[0] {
				g[i] = r.Interface()
			}
			got = g
		}
		claims[name] = got
	}
	return claims, nil
}

func (c *CustomClaims) makeRequest(ctx context.Context, userID string) (map[string]any, error) {
	buf := new(bytes.Buffer)
	if err := json.NewEncoder(buf).Encode(map[string]interface{}{
		"query": c.graphqlQuery,
		"variables": map[string]interface{}{
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
		return nil, fmt.Errorf( //nolint:goerr113
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
		return nil, fmt.Errorf("failed to extract data from response") //nolint:goerr113
	}

	data, ok = data["user"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("failed to extract user data from response") //nolint:goerr113
	}

	return c.ExtractClaims(data)
}
