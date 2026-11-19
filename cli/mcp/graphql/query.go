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

// typenameField is the meta field every GraphQL type exposes. It only returns
// the name of the object type, so it is allowed without an allowlist entry.
const typenameField = "__typename"

// fragmentVisit identifies a fragment walked at a given depth. The same
// fragment is checked differently at the root and in nested selections.
type fragmentVisit struct {
	name string
	root bool
}

// operationChecker walks the selections of one operation, following inline
// fragments and fragment spreads so every field reachable from the operation
// is checked against the allowlist.
type operationChecker struct {
	allowed   []string
	fragments ast.FragmentDefinitionList
	visited   map[fragmentVisit]struct{}
}

// checkSelectionSet checks the fields in selectionSet. Every root field must
// be allowlisted, whether or not it has a sub-selection. Below the root, only
// fields with a sub-selection must be allowlisted, so leaf fields such as `id`
// don't need their own entry.
func (c *operationChecker) checkSelectionSet(selectionSet ast.SelectionSet, root bool) error {
	for _, selection := range selectionSet {
		switch v := selection.(type) {
		case *ast.Field:
			if err := c.checkField(v, root); err != nil {
				return err
			}
		case *ast.InlineFragment:
			if err := c.checkSelectionSet(v.SelectionSet, root); err != nil {
				return err
			}
		case *ast.FragmentSpread:
			if err := c.checkFragmentSpread(v, root); err != nil {
				return err
			}
		default:
			return fmt.Errorf("%w: unsupported selection %T", ErrQueryNotAllowed, selection)
		}
	}

	return nil
}

func (c *operationChecker) checkField(field *ast.Field, root bool) error {
	mustBeAllowed := len(field.SelectionSet) > 0 || (root && field.Name != typenameField)
	if mustBeAllowed && !slices.Contains(c.allowed, field.Name) {
		return fmt.Errorf("%w: %s", ErrQueryNotAllowed, field.Name)
	}

	return c.checkSelectionSet(field.SelectionSet, false)
}

func (c *operationChecker) checkFragmentSpread(spread *ast.FragmentSpread, root bool) error {
	visit := fragmentVisit{name: spread.Name, root: root}
	if _, ok := c.visited[visit]; ok {
		// Already checked, or being checked further up the stack (a cycle).
		return nil
	}

	c.visited[visit] = struct{}{}

	fragment := c.fragments.ForName(spread.Name)
	if fragment == nil {
		return fmt.Errorf("%w: unknown fragment %s", ErrQueryNotAllowed, spread.Name)
	}

	return c.checkSelectionSet(fragment.SelectionSet, root)
}

func checkAllowedOperation(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	allowed []string,
) error {
	if slices.Contains(allowed, "*") {
		return nil
	}

	checker := &operationChecker{
		allowed:   allowed,
		fragments: fragments,
		visited:   map[fragmentVisit]struct{}{},
	}

	return checker.checkSelectionSet(selectionSet, true)
}

// checkUniqueFragmentNames rejects documents that define the same fragment
// twice, so the fragment checked here is the one the server executes.
func checkUniqueFragmentNames(fragments ast.FragmentDefinitionList) error {
	seen := make(map[string]struct{}, len(fragments))
	for _, fragment := range fragments {
		if _, ok := seen[fragment.Name]; ok {
			return fmt.Errorf("%w: duplicate fragment %s", ErrQueryNotAllowed, fragment.Name)
		}

		seen[fragment.Name] = struct{}{}
	}

	return nil
}

func CheckAllowedGraphqlQuery(
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

	if err := checkUniqueFragmentNames(query.Fragments); err != nil {
		return err
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

		if err := checkAllowedOperation(selectionSet, query.Fragments, allowed); err != nil {
			return fmt.Errorf("%w: %w", ErrQueryNotAllowed, err)
		}
	}

	return nil
}

func Query[T any](
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
