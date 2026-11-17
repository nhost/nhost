package where_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

type aliasTableCall struct{ target string }

func (c aliasTableCall) SQLType() string         { return "record" }
func (c aliasTableCall) SourceColumns() []string { return nil }
func (c aliasTableCall) TargetSchema() string    { return "public" }
func (c aliasTableCall) TargetName() string      { return c.target }
func (c aliasTableCall) WriteExpression(
	b *strings.Builder, source string, _ map[string]any, params []any, index int,
) ([]any, int, error) {
	b.WriteString(`"public"."` + c.target + `"(` + source + `)`)
	return params, index, nil
}

func TestComputedTableQueryAliasPreservesPermissionRoot(t *testing.T) {
	t.Parallel()

	column := &core.Column{SQLName: "owner_id", GraphqlName: "owner_id", SQLType: "integer"}
	child := &parseTestTable{
		d:       dialect.NewPostgresDialect(),
		columns: map[string]*core.Column{"owner_id": column},
	}
	target := &parseTestTable{
		d:       dialect.NewPostgresDialect(),
		columns: map[string]*core.Column{"owner_id": column},
		computedTable: map[string]core.ComputedTableExpression{
			"children": aliasTableCall{target: "child"},
		},
		roleHasPerms: map[string]bool{"user": true},
	}

	parent := &parseTestTable{
		d: dialect.NewPostgresDialect(),
		computedTable: map[string]core.ComputedTableExpression{
			"items": aliasTableCall{target: "target"},
		},
	}
	for _, table := range []*parseTestTable{parent, target, child} {
		table.siblings = map[string]where.Table{"public.target": target, "public.child": child}
	}

	permissionValue, err := values.GoValueToAST(map[string]any{"children": map[string]any{
		"owner_id": map[string]any{"_ceq": []any{"$", "owner_id"}},
	}})
	if err != nil {
		t.Fatal(err)
	}

	permission, err := where.Parse(
		target,
		permissionValue,
		nil,
		"",
		nil,
		0,
		where.PermissionAliases,
	)
	if err != nil {
		t.Fatal(err)
	}

	target.permsWriter = func(b *strings.Builder, params []any, index int, source string) ([]any, int, error) {
		return permission.WriteCondition(b, source, params, index)
	}

	userValue, err := values.GoValueToAST(map[string]any{"items": map[string]any{}})
	if err != nil {
		t.Fatal(err)
	}

	query, err := where.Parse(parent, userValue, nil, "user", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatal(err)
	}

	var sql strings.Builder
	if _, _, err := query.WriteCondition(&sql, `"p"`, nil, 1); err != nil {
		t.Fatal(err)
	}

	got := sql.String()
	if !strings.Contains(
		got,
		`AS "_cs_cff0" WHERE EXISTS (SELECT 1 FROM "public"."child"("_cs_cff0") AS "_cs_cfg0" WHERE "_cs_cfg0"."owner_id" = "_cs_cff0"."owner_id")`,
	) {
		t.Fatalf("permission root rebound inside computed table: %s", got)
	}
}
