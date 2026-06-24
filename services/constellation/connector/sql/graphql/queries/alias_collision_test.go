package queries_test

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestQueryRelationshipAliasesAvoidPostgresIdentifierTruncationCollision(
	t *testing.T,
) {
	t.Parallel()

	longRelationshipAlias := "thisRelationshipAliasIsLongEnoughToCollideAfterPgTrunc"
	roots := buildAliasCollisionRoots(t)

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: `
		query {
			departments {
				id
				` + longRelationshipAlias + `: employees {
					user {
						id
					}
				}
			}
		}
	`})
	if gqlErr != nil {
		t.Fatalf("failed to parse query: %v", gqlErr)
	}

	operations, err := roots.BuildQuery(
		doc.Operations[0], doc.Fragments, nil, "admin", nil,
	)
	if err != nil {
		t.Fatalf("failed to build query: %v", err)
	}

	if len(operations) != 1 {
		t.Fatalf("expected one operation, got %d", len(operations))
	}

	baseAlias := "_root.r." + longRelationshipAlias + ".base"

	userRelAlias := "_root.r." + longRelationshipAlias + ".r.user"
	if truncatePostgresIdentifier(baseAlias) != truncatePostgresIdentifier(userRelAlias) {
		t.Fatalf("test setup no longer produces a PostgreSQL truncation collision")
	}

	sql := operations[0].SQL
	if strings.Contains(sql, `"`+baseAlias+`"`) || strings.Contains(sql, `"`+userRelAlias+`"`) {
		t.Fatalf(
			"SQL contains relationship aliases that collide after PostgreSQL truncation:\n%s",
			sql,
		)
	}
}

func buildAliasCollisionRoots(t *testing.T) queries.Roots {
	t.Helper()

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"departments": {
				Schema: "public",
				Name:   "departments",
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
			},
			"user_departments": {
				Schema: "public",
				Name:   "user_departments",
				Columns: []introspection.Column{
					{Name: "department_id", Type: "uuid"},
					{Name: "user_id", Type: "uuid"},
				},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "department_id",
						ForeignSchema:     "public",
						ForeignTable:      "departments",
						ForeignColumnName: "id",
					},
					{
						ColumnName:        "user_id",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
			},
			"users": {
				Schema: "public",
				Name:   "users",
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
			},
		},
	}

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "departments"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "employees",
						Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"department_id"},
								Table: metadata.TableSource{
									Schema: "public",
									Name:   "user_departments",
								},
							},
						},
					},
				},
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "user_departments"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "user",
						Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"user_id"},
						},
					},
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("failed to build roots: %v", err)
	}

	return roots
}

func truncatePostgresIdentifier(identifier string) string {
	const maxPostgresIdentifierBytes = 63
	if len(identifier) <= maxPostgresIdentifierBytes {
		return identifier
	}

	return identifier[:maxPostgresIdentifierBytes]
}
