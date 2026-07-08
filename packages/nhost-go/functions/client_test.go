package functions_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/functions"
)

func TestPostDecodesJSON(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)

		var parsed map[string]any

		_ = json.Unmarshal(body, &parsed)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"body": parsed, "method": r.Method})
	}))
	defer srv.Close()

	c := functions.NewClient(srv.URL, nil, srv.Client())

	resp, err := c.Post(context.Background(), "/echo", map[string]any{"message": "hello"}, nil)
	if err != nil {
		t.Fatalf("post: %v", err)
	}

	out, ok := resp.Body.(map[string]any)
	if !ok {
		t.Fatalf("body type = %T", resp.Body)
	}

	inner, ok := out["body"].(map[string]any)
	if !ok || inner["message"] != "hello" {
		t.Fatalf("echoed body = %v", out["body"])
	}

	if out["method"] != http.MethodPost {
		t.Fatalf("method = %v", out["method"])
	}
}
