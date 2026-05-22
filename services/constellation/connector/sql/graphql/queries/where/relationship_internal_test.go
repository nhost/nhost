package where

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// stubTable is a controllable Table double used by the relationship/exists
// filter tests. The boolean and writer fields drive the optional permission
// branches without standing up gomock (which would introduce an import cycle
// with this package's own mock).
type stubTable struct {
	tableFromClause string
	hasRowLevelPerm bool
	permWriter      func(b *strings.Builder, params []any, paramIndex int) ([]any, int, error)
}

func (s *stubTable) Dialect() dialect.Dialect                        { return nil }
func (s *stubTable) SchemaName() string                              { return "" }
func (s *stubTable) TableFromClause() string                         { return s.tableFromClause }
func (s *stubTable) ColumnFromGraphqlName(string) *core.Column       { return nil }
func (s *stubTable) RelationshipFromGraphqlName(string) Relationship { return nil }
func (s *stubTable) TableBySchemaName(_, _ string) Table             { return nil }
func (s *stubTable) HasRowLevelPermissions(string) bool              { return s.hasRowLevelPerm }

//nolint:nilnil // test stub returns nil/nil intentionally.
func (s *stubTable) ParseFieldComparison(
	_ *core.Column, _ *ast.Value, _ map[string]any,
) (Statement, error) {
	return nil, nil
}

func (s *stubTable) WriteRowLevelPermissions(
	b *strings.Builder, params []any, paramIndex int, _ string, _ map[string]any, _ string,
) ([]any, int, error) {
	if s.permWriter != nil {
		return s.permWriter(b, params, paramIndex)
	}

	return params, paramIndex, nil
}

// stubRelationship is a controllable Relationship double used by the
// relationship filter tests. joinWriter receives parent/target aliases for
// inspection in assertions.
type stubRelationship struct {
	target     Table
	parentCols []string
	joinWriter func(b *strings.Builder, parent, target string)
}

func (s *stubRelationship) Target() Table           { return s.target }
func (s *stubRelationship) ParentColumns() []string { return s.parentCols }
func (s *stubRelationship) WriteJoinConditionAliased(b *strings.Builder, parent, target string) {
	if s.joinWriter != nil {
		s.joinWriter(b, parent, target)
	}
}

func defaultJoinWriter(b *strings.Builder, parent, target string) {
	b.WriteString(parent)
	b.WriteString(".pk = ")
	b.WriteString(target)
	b.WriteString(".fk")
}

func TestRelationshipFilter_NoRoleNoConditions(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."authors"`}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	f := &relationshipFilter{
		relationship: rel,
		conditions:   nil,
		role:         "",
		nestingLevel: 0,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	params, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.HasPrefix(sql, "EXISTS (SELECT 1 FROM ") {
		t.Errorf("expected EXISTS prefix, got %q", sql)
	}

	if !strings.Contains(sql, `"public"."authors" f`) {
		t.Errorf("expected target alias %q, got %q", `"public"."authors" f`, sql)
	}

	if !strings.Contains(sql, `"parent".pk = f.fk`) {
		t.Errorf("expected join condition, got %q", sql)
	}

	if strings.Contains(sql, " AND ") {
		t.Errorf("no inner conditions → no AND expected, got %q", sql)
	}

	if params != nil {
		t.Errorf("no inner conditions → no params expected, got %v", params)
	}
}

func TestRelationshipFilter_WithNestedConditions(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."authors"`}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	inner := &rawFilter{condition: `f."active" = true`}

	f := &relationshipFilter{
		relationship: rel,
		conditions:   inner,
		role:         "",
		nestingLevel: 0,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, ` AND f."active" = true`) {
		t.Errorf("expected inner condition after AND, got %q", sql)
	}
}

func TestRelationshipFilter_AppliesRowLevelPermissions(t *testing.T) {
	t.Parallel()

	target := &stubTable{
		tableFromClause: `"public"."authors"`,
		hasRowLevelPerm: true,
		permWriter: func(b *strings.Builder, params []any, paramIndex int) ([]any, int, error) {
			b.WriteString(`f."user_id" = $1`)
			return append(params, "alice"), paramIndex + 1, nil
		},
	}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	f := &relationshipFilter{
		relationship: rel,
		conditions:   nil,
		role:         "user",
		nestingLevel: 0,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	params, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, `f."user_id" = $1`) {
		t.Errorf("expected permission predicate, got %q", sql)
	}

	if len(params) != 1 || params[0] != "alice" {
		t.Errorf("expected permission to append session value, got %v", params)
	}
}

func TestRelationshipFilter_SkipsPermissionsWhenRoleHasNone(t *testing.T) {
	t.Parallel()

	target := &stubTable{
		tableFromClause: `"public"."authors"`,
		hasRowLevelPerm: false,
		permWriter: func(_ *strings.Builder, _ []any, _ int) ([]any, int, error) {
			t.Fatal("permWriter must not be called when HasRowLevelPermissions is false")
			return nil, 0, nil
		},
	}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	f := &relationshipFilter{
		relationship: rel,
		conditions:   nil,
		role:         "user",
		nestingLevel: 0,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}
}

func TestRelationshipFilter_NestingLevelChangesAlias(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."t"`}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	f := &relationshipFilter{
		relationship: rel,
		conditions:   nil,
		role:         "",
		nestingLevel: 2,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, `"public"."t" "f2"`) {
		t.Errorf(`expected target alias "f2" at nestingLevel 2, got %q`, sql)
	}
}

func TestRelationshipFilter_InnerConditionError(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."t"`}
	rel := &stubRelationship{target: target, joinWriter: defaultJoinWriter}

	boom := errors.New("boom") //nolint:err113 // test sentinel

	f := &relationshipFilter{
		relationship: rel,
		conditions:   &errStatement{err: boom},
		role:         "",
		nestingLevel: 0,
		aliasPrefix:  "f",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, `"parent"`, nil, 1)
	if err == nil || !errors.Is(err, boom) {
		t.Fatalf("expected wrapped boom, got %v", err)
	}
}

func TestExistsFilter_NoConditions(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."widgets"`}

	f := &existsFilter{
		targetTable:  target,
		conditions:   nil,
		nestingLevel: 0,
		aliasPrefix:  "e",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, "ignored", nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, `"public"."widgets" e`) {
		t.Errorf("expected target alias e, got %q", sql)
	}

	if strings.Contains(sql, " WHERE ") {
		t.Errorf("no conditions → no WHERE expected, got %q", sql)
	}
}

func TestExistsFilter_WithConditions(t *testing.T) {
	t.Parallel()

	target := &stubTable{tableFromClause: `"public"."widgets"`}

	f := &existsFilter{
		targetTable:  target,
		conditions:   &rawFilter{condition: `e."active" = true`},
		nestingLevel: 1,
		aliasPrefix:  "e",
	}

	var b strings.Builder

	_, _, err := f.WriteCondition(&b, "ignored", nil, 1)
	if err != nil {
		t.Fatalf("Writecondition: %v", err)
	}

	sql := b.String()
	if !strings.Contains(sql, ` WHERE e."active" = true`) {
		t.Errorf("expected WHERE clause from conditions, got %q", sql)
	}

	if !strings.Contains(sql, `"e1"`) {
		t.Errorf(`expected nested alias "e1" at nestingLevel 1, got %q`, sql)
	}
}

// errStatement is a Statement that always returns the configured error.
type errStatement struct{ err error }

func (e *errStatement) WriteCondition(
	_ *strings.Builder, _ string, _ []any, _ int,
) ([]any, int, error) {
	return nil, 0, e.err
}
