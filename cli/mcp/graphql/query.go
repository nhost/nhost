package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

var (
	ErrQueryingGraphqlEndpoint = errors.New("error querying graphql endpoint")
	ErrGraphqlContainErrors    = errors.New("graphql response contains errors")
	ErrQueryNotAllowed         = errors.New("query not allowed")
)

func checkAllowedOperation(
	selectionSet ast.SelectionSet,
	allowed []string,
) error {
	if slices.Contains(allowed, "*") {
		return nil
	}

	for _, v := range selectionSet {
		if v, ok := v.(*ast.Field); ok {
			if len(v.SelectionSet) > 0 && !slices.Contains(allowed, v.Name) {
				return fmt.Errorf("%w: %s", ErrQueryNotAllowed, v.Name)
			}

			if err := checkAllowedOperation(v.SelectionSet, allowed); err != nil {
				return err
			}
		}
	}

	return nil
}

func CheckAllowedGraphqlQuery( //nolint:cyclop
	allowedQueries []string,
	allowedMutations []string,
	queryString string,
) error {
	if allowedQueries == nil && allowedMutations == nil {
		// nil means nothing allowed
		return fmt.Errorf("%w: %s", ErrQueryNotAllowed, queryString)
	}

	if len(allowedQueries) == 0 && len(allowedMutations) == 0 {
		// no queries or mutations allowed
		return fmt.Errorf("%w: %s", ErrQueryNotAllowed, queryString)
	}

	query, err := parser.ParseQuery(&ast.Source{
		Name:    "schema.graphql",
		Input:   queryString,
		BuiltIn: false,
	})
	if err != nil {
		return fmt.Errorf("failed to parse query: %w", err)
	}

	for _, operation := range query.Operations {
		if operation.Operation == ast.Subscription {
			return fmt.Errorf("%w: %s", ErrQueryNotAllowed, queryString)
		}

		var (
			selectionSet ast.SelectionSet
			allowed      []string
		)

		if operation.Operation == ast.Query {
			selectionSet = operation.SelectionSet
			allowed = allowedQueries
		}

		if operation.Operation == ast.Mutation {
			selectionSet = operation.SelectionSet
			allowed = allowedMutations
		}

		if err := checkAllowedOperation(selectionSet, allowed); err != nil {
			return fmt.Errorf("%w: %w", ErrQueryNotAllowed, err)
		}
	}

	return nil
}

func Query[T any]( //nolint:cyclop
	ctx context.Context,
	graphqlURL string,
	query string,
	variables map[string]any,
	response *Response[T],
	allowedQueries []string,
	allowedMutations []string,
	requestInterceptor ...func(ctx context.Context, req *http.Request) error,
) error {
	if err := CheckAllowedGraphqlQuery(allowedQueries, allowedMutations, query); err != nil {
		return err
	}

	requestBody, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": variables,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		graphqlURL,
		bytes.NewBuffer(requestBody),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")

	for _, interceptor := range requestInterceptor {
		if err := interceptor(ctx, request); err != nil {
			return fmt.Errorf("failed to intercept request: %w", err)
		}
	}

	client := &http.Client{} //nolint:exhaustruct

	resp, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%w: %s\n%s", ErrQueryingGraphqlEndpoint, resp.Status, b)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, response); err != nil {
		return fmt.Errorf("failed to unmarshal response body: %w", err)
	}

	if len(response.Errors) > 0 {
		return fmt.Errorf("%w: %s", ErrGraphqlContainErrors, body)
	}

	return nil
}
