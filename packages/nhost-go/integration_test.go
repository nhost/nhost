//go:build integration

package nhost_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
)

// These tests require a local Nhost backend (`./dev-env.sh up`) and only run
// under the `integration` build tag with NHOST_LOCAL_BACKEND set.

func requireBackend(t *testing.T) {
	t.Helper()

	if os.Getenv("NHOST_LOCAL_BACKEND") == "" {
		t.Skip("set NHOST_LOCAL_BACKEND=1 and run with -tags integration against a local backend")
	}
}

func randomEmail(t *testing.T) string {
	t.Helper()

	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("rand: %v", err)
	}

	return "ada-" + hex.EncodeToString(buf) + "@example.com"
}

func localClient() *nhost.Client {
	return nhost.CreateClient(nhost.Options{Subdomain: "local", Region: "local"})
}

func TestIntegrationSignUpDecodesRole(t *testing.T) {
	requireBackend(t)

	client := localClient()
	ctx := context.Background()

	_, err := client.Auth.SignUpEmailPassword(ctx, auth.SignUpEmailPasswordRequest{
		Email:    randomEmail(t),
		Password: hexPassword(t),
	}, nil)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}

	stored, ok := client.GetUserSession()
	if !ok {
		t.Fatal("no session after signup")
	}

	role, _ := stored.DecodedToken.HasuraClaims["x-hasura-default-role"].(string)
	if role != "user" {
		t.Fatalf("default role = %q, want user", role)
	}
}

func TestIntegrationGraphQLTypename(t *testing.T) {
	requireBackend(t)

	client := localClient()

	resp, err := client.GraphQL.Request(context.Background(), "query { __typename }", nil, "", nil)
	if err != nil {
		t.Fatalf("graphql: %v", err)
	}

	if resp.Body.Data["__typename"] != "query_root" {
		t.Fatalf("__typename = %v", resp.Body.Data["__typename"])
	}
}

func TestIntegrationFunctionsEcho(t *testing.T) {
	requireBackend(t)

	client := localClient()

	resp, err := client.Functions.Post(
		context.Background(), "/echo", map[string]any{"message": "hello"}, nil,
	)
	if err != nil {
		t.Fatalf("functions: %v", err)
	}

	out, _ := resp.Body.(map[string]any)
	inner, _ := out["body"].(map[string]any)

	if inner["message"] != "hello" {
		t.Fatalf("echo body = %v", out["body"])
	}
}

func hexPassword(t *testing.T) string {
	t.Helper()

	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("rand: %v", err)
	}

	return hex.EncodeToString(buf)
}
