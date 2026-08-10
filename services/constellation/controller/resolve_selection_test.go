package controller_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
)

func TestResolve_RootTypenameResolvesToRootTypeName(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __typename }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors for { __typename }, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if data["__typename"] != "query_root" {
		t.Fatalf("expected __typename query_root, got %v", data["__typename"])
	}
}

func TestResolve_RootTypenameAliasAndMixedWithData(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ tn: __typename users { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if data["tn"] != "query_root" {
		t.Errorf("expected aliased __typename query_root, got %v", data["tn"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Errorf("expected users data alongside __typename, got %v", data)
	}
}

func TestResolve_MixedIntrospectionAndDataReturnsBoth(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __schema { queryType { name } } users { id name } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if _, hasSchema := data["__schema"]; !hasSchema {
		t.Errorf("expected __schema in mixed response, got %v", data)
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Errorf("expected users data in mixed response (was dropped before fix), got %v", data)
	}
}

func TestResolve_PureIntrospectionUnchanged(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __schema { queryType { name } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if _, hasSchema := data["__schema"]; !hasSchema {
		t.Errorf("expected __schema, got %v", data)
	}

	if _, hasUsers := data["users"]; hasUsers {
		t.Errorf("pure introspection must not invent data fields, got %v", data)
	}
}

func TestResolve_SkipVariableDriven(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "Q",
		Query:         `query Q($s: Boolean!) { users @skip(if: $s) { id } }`,
		Variables:     map[string]any{"s": true},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T (%v)", resp.Data, resp.Data)
	}

	if _, hasUsers := data["users"]; hasUsers {
		t.Fatalf("variable-driven @skip(if:true) should drop users, got %v", data)
	}
}
