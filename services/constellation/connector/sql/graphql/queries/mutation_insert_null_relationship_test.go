package queries_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	graphqlschema "github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type nullNestedInsertCase struct {
	name, query, variables, wantQuery, wantVariables string
	authors, posts, nullNames                        int
	coercionError, executionError                    string
}

//nolint:paralleltest,tparallel // Sequential mutations reuse one pool and reset the shared fixture between cases.
func TestNullNestedInsertPostgres(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(t, `
CREATE TABLE authors(id text PRIMARY KEY, name text DEFAULT 'default-name', owner text NOT NULL);
CREATE TABLE posts(id text PRIMARY KEY, author_id text NOT NULL REFERENCES authors(id));
INSERT INTO authors VALUES ('existing', 'existing', 'seed');`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	t.Cleanup(pool.Close)
	client := postgres.NewClient(pool)
	md := nullNestedInsertMetadata()

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	d := dialect.NewPostgresDialect()
	caps := graphqlschema.NewCapabilities(graphqlschema.KindPostgres, d)

	graph, err := graphqlschema.GenerateForRole(objects, "writer", md, caps)
	if err != nil {
		t.Fatalf("GenerateForRole: %v", err)
	}

	_, schema, err := schemamerge.BuildValidatedSchema(graph, "writer")
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, d, caps)
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	tests := []nullNestedInsertCase{
		{
			name: "array relationship variable and explicit null column",
			query: `mutation($posts:posts_arr_rel_insert_input){
				insert_authors_one(object:{id:"a",name:null,posts:$posts}){id name owner}}`,
			variables: `{"posts":null}`,
			wantQuery: `mutation{insert_authors_one(object:{id:"a",name:null}){id name owner}}`,
			authors:   1, nullNames: 1,
		},
		{
			name: "object relationship variable preserves explicit foreign key",
			query: `mutation($author:authors_obj_rel_insert_input){
				insert_posts_one(object:{id:"p",author_id:"existing",author:$author}){id author_id}}`,
			variables: `{"author":null}`,
			wantQuery: `mutation{insert_posts_one(object:{id:"p",author_id:"existing"}){id author_id}}`,
			posts:     1,
		},
		{
			name:          "array null inside whole object variable",
			query:         `mutation($object:authors_insert_input!){insert_authors_one(object:$object){id name owner}}`,
			variables:     `{"object":{"id":"a","posts":null}}`,
			wantVariables: `{"object":{"id":"a"}}`,
			authors:       1,
		},
		{
			name:          "object null inside whole object variable",
			query:         `mutation($object:posts_insert_input!){insert_posts_one(object:$object){id author_id}}`,
			variables:     `{"object":{"id":"p","author_id":"existing","author":null}}`,
			wantVariables: `{"object":{"id":"p","author_id":"existing"}}`,
			posts:         1,
		},
		{
			name:      "literal null wrapper",
			query:     `mutation{insert_authors_one(object:{id:"a",posts:null}){id}}`,
			variables: `{}`,
			wantQuery: `mutation{insert_authors_one(object:{id:"a"}){id}}`,
			authors:   1,
		},
		{
			name:          "whole bulk list variable",
			query:         `mutation($objects:[authors_insert_input!]!){insert_authors(objects:$objects){affected_rows returning{id}}}`,
			variables:     `{"objects":[{"id":"a","posts":null},{"id":"b","posts":null}]}`,
			wantVariables: `{"objects":[{"id":"a"},{"id":"b"}]}`,
			authors:       2,
		},
		{
			name:          "bulk object variable element",
			query:         `mutation($object:authors_insert_input!){insert_authors(objects:[$object,{id:"b",posts:null}]){affected_rows}}`,
			variables:     `{"object":{"id":"a","posts":null}}`,
			wantQuery:     `mutation($object:authors_insert_input!){insert_authors(objects:[$object,{id:"b"}]){affected_rows}}`,
			wantVariables: `{"object":{"id":"a"}}`,
			authors:       2,
		},
		{
			name: "recursive object wrapper variable preserves inherited foreign key",
			query: `mutation($author:authors_obj_rel_insert_input){
				insert_authors_one(object:{id:"a",posts:{data:[{id:"p",author:$author}]}}){id posts{id author_id}}}`,
			variables: `{"author":null}`,
			wantQuery: `mutation{insert_authors_one(object:{id:"a",posts:{data:[{id:"p"}]}}){id posts{id author_id}}}`,
			authors:   1,
			posts:     1,
		},
		{
			name:          "recursive array wrapper inside whole object",
			query:         `mutation($object:posts_insert_input!){insert_posts_one(object:$object){id author{id owner}}}`,
			variables:     `{"object":{"id":"p","author":{"data":{"id":"a","posts":null}}}}`,
			wantVariables: `{"object":{"id":"p","author":{"data":{"id":"a"}}}}`,
			authors:       1,
			posts:         1,
		},
		{
			name:          "missing array data remains required",
			query:         `mutation($posts:posts_arr_rel_insert_input){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{"posts":{}}`,
			coercionError: "data",
		},
		{
			name:          "null array data remains required",
			query:         `mutation($posts:posts_arr_rel_insert_input){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{"posts":{"data":null}}`,
			coercionError: "data",
		},
		{
			name:          "null array element remains required",
			query:         `mutation($posts:posts_arr_rel_insert_input){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{"posts":{"data":[null]}}`,
			coercionError: "data",
		},
		{
			name:          "missing object data remains required",
			query:         `mutation($author:authors_obj_rel_insert_input){insert_posts_one(object:{id:"p",author:$author}){id}}`,
			variables:     `{"author":{}}`,
			coercionError: "data",
		},
		{
			name:          "null object data remains required",
			query:         `mutation($author:authors_obj_rel_insert_input){insert_posts_one(object:{id:"p",author:$author}){id}}`,
			variables:     `{"author":{"data":null}}`,
			coercionError: "data",
		},
		{
			name:          "missing required wrapper variable",
			query:         `mutation($posts:posts_arr_rel_insert_input!){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{}`,
			coercionError: "posts",
		},
		{
			name:          "null required wrapper variable",
			query:         `mutation($posts:posts_arr_rel_insert_input!){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{"posts":null}`,
			coercionError: "posts",
		},
		{
			name:          "non-object wrapper remains invalid",
			query:         `mutation($posts:posts_arr_rel_insert_input){insert_authors_one(object:{id:"a",posts:$posts}){id}}`,
			variables:     `{"posts":"invalid"}`,
			coercionError: "posts",
		},
		{
			name:           "parent permission still enforced with null wrapper",
			query:          `mutation($posts:posts_arr_rel_insert_input){insert_authors_one(object:{id:"denied",posts:$posts}){id}}`,
			variables:      `{"posts":null}`,
			executionError: "SQLSTATE ZZ901",
		},
		{
			name:           "nested permission denial rolls back parent with recursive null wrapper",
			query:          `mutation($object:authors_insert_input!){insert_authors_one(object:$object){id}}`,
			variables:      `{"object":{"id":"a","posts":{"data":[{"id":"denied","author":null}]}}}`,
			executionError: "SQLSTATE ZZ901",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := pool.Exec(
				t.Context(),
				`TRUNCATE posts; DELETE FROM authors WHERE id != 'existing'`,
			); err != nil {
				t.Fatalf("reset fixture: %v", err)
			}

			defer assertNullNestedInsertRows(t, pool, tt.authors, tt.posts, tt.nullNames)

			runNullNestedInsertCase(t, roots, schema, client, tt)
		})
	}

	t.Run("raw SQL boundary rejects malformed non-null wrappers", func(t *testing.T) {
		tests := []struct{ name, wrapper, message string }{
			{"missing data", `{}`, "missing data field"},
			{"null data", `{data:null}`, "must be a list of objects"},
			{"null data element", `{data:[null]}`, "must be an object"},
			{"non-object", `"invalid"`, "must be an object"},
			{"unresolved variable", `$missing`, "variable not found"},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				doc, err := parser.ParseQuery(
					&ast.Source{
						Input: `mutation{insert_authors_one(object:{id:"a",posts:` + tt.wrapper + `}){id}}`,
					},
				)
				if err != nil {
					t.Fatal(err)
				}

				ops, err := roots.BuildQuery(
					doc.Operations[0],
					doc.Fragments,
					nil,
					"writer",
					map[string]any{"x-hasura-user-id": "writer-id"},
				)
				if err == nil || !strings.Contains(err.Error(), tt.message) || len(ops) != 0 {
					t.Fatalf("BuildQuery = %v, %v; want no operations and %q", ops, err, tt.message)
				}
			})
		}
	})
}

func runNullNestedInsertCase(
	t *testing.T,
	roots queries.Roots,
	schema *ast.Schema,
	client *postgres.Client,
	tt nullNestedInsertCase,
) {
	t.Helper()

	doc, errs := gqlparser.LoadQueryWithRules(schema, tt.query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatalf("LoadQueryWithRules: %v", errs)
	}

	var provided map[string]any
	if err := json.Unmarshal([]byte(tt.variables), &provided); err != nil {
		t.Fatalf("Unmarshal variables: %v", err)
	}

	coerced, err := validator.VariableValues(schema, doc.Operations[0], provided)
	if tt.coercionError != "" {
		if err == nil || !strings.Contains(err.Error(), tt.coercionError) {
			t.Fatalf("VariableValues error = %v, want %q", err, tt.coercionError)
		}

		return
	}

	if err != nil {
		t.Fatalf("VariableValues: %v", err)
	}

	ops := buildNullNestedInsert(t, roots, doc, coerced)
	if tt.executionError == "" {
		wantQuery := tt.wantQuery
		if wantQuery == "" {
			wantQuery = tt.query
		}

		assertNullNestedInsertOmitted(t, roots, schema, ops, wantQuery, tt.wantVariables)
	}

	_, err = client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if tt.executionError != "" {
		if err == nil || !strings.Contains(err.Error(), tt.executionError) {
			t.Fatalf("ExecuteOperations error = %v, want %q", err, tt.executionError)
		}

		return
	}

	if err != nil {
		t.Fatalf("ExecuteOperations: %v", err)
	}
}

func assertNullNestedInsertRows(
	t *testing.T,
	pool postgres.Pool,
	wantAuthors, wantPosts, wantNullNames int,
) {
	t.Helper()

	wantAuthorID := "existing"
	if wantAuthors > 0 {
		wantAuthorID = "a"
	}

	var authors, posts, nullNames, invalidAuthors, invalidPosts int
	if err := pool.QueryRow(t.Context(), `SELECT
(SELECT count(*) FROM authors WHERE id != 'existing'), (SELECT count(*) FROM posts),
(SELECT count(*) FROM authors WHERE id != 'existing' AND name IS NULL),
(SELECT count(*) FROM authors WHERE id != 'existing' AND (owner != 'writer-id' OR (name IS NOT NULL AND name != 'default-name'))),
(SELECT count(*) FROM posts WHERE author_id != $1)`, wantAuthorID).
		Scan(&authors, &posts, &nullNames, &invalidAuthors, &invalidPosts); err != nil {
		t.Fatalf("persisted rows: %v", err)
	}

	want := []int{wantAuthors, wantPosts, wantNullNames, 0, 0}

	got := []int{authors, posts, nullNames, invalidAuthors, invalidPosts}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("authors/posts/null names/invalid authors/invalid posts (-want +got):\n%s", diff)
	}
}

func assertNullNestedInsertOmitted(
	t *testing.T,
	roots queries.Roots,
	schema *ast.Schema,
	ops []core.SQLOperation,
	query, variables string,
) {
	t.Helper()

	if variables == "" {
		variables = `{}`
	}

	doc, errs := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if len(errs) != 0 {
		t.Fatalf("omitted control validation: %v", errs)
	}

	var input map[string]any
	if err := json.Unmarshal([]byte(variables), &input); err != nil {
		t.Fatal(err)
	}

	coerced, err := validator.VariableValues(schema, doc.Operations[0], input)
	if err != nil {
		t.Fatalf("omitted control coercion: %v", err)
	}

	want := buildNullNestedInsert(t, roots, doc, coerced)
	if diff := cmp.Diff(want, ops); diff != "" {
		t.Fatalf("plans and parameters (-omitted +null):\n%s", diff)
	}
}

func buildNullNestedInsert(
	t *testing.T,
	roots queries.Roots,
	doc *ast.QueryDocument,
	variables map[string]any,
) []core.SQLOperation {
	t.Helper()

	var before bytes.Buffer
	formatter.NewFormatter(&before).FormatQueryDocument(doc)

	original, err := json.Marshal(variables)
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		variables,
		"writer",
		map[string]any{"x-hasura-user-id": "writer-id"},
	)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	var after bytes.Buffer
	formatter.NewFormatter(&after).FormatQueryDocument(doc)

	remaining, err := json.Marshal(variables)
	if err != nil {
		t.Fatal(err)
	}

	if before.String() != after.String() || !bytes.Equal(original, remaining) {
		t.Fatal("BuildQuery mutated the validated AST or request variables")
	}

	return ops
}

func nullNestedInsertMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres", Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "authors"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{Name: "posts", Using: metadata.RelationshipUsing{
						ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
							Table:   metadata.TableSource{Schema: "public", Name: "posts"},
							Columns: []string{"author_id"},
						},
					}},
				},
				SelectPermissions: []metadata.SelectPermission{
					{Role: "writer", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "name", "owner"}, Filter: map[string]any{},
					}},
				},
				InsertPermissions: []metadata.InsertPermission{
					{Role: "writer", Permission: metadata.InsertPermissionConfig{
						Columns: []string{
							"id",
							"name",
						},
						Set: map[string]any{"owner": "X-Hasura-User-Id"},
						Check: map[string]any{
							"id":    map[string]any{"_neq": "denied"},
							"owner": map[string]any{"_eq": "X-Hasura-User-Id"},
						},
					}},
				},
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "posts"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name:  "author",
						Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"author_id"}},
					},
				},
				SelectPermissions: []metadata.SelectPermission{
					{Role: "writer", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "author_id"}, Filter: map[string]any{},
					}},
				},
				InsertPermissions: []metadata.InsertPermission{
					{Role: "writer", Permission: metadata.InsertPermissionConfig{
						Columns: []string{
							"id",
							"author_id",
						},
						Check: map[string]any{"id": map[string]any{"_neq": "denied"}},
					}},
				},
			},
		},
	}
}
