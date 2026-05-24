package planner

import (
	"maps"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// ---------- mergePhantomResults ----------

func TestMergePhantomResults_CopiesColumnsAndOverridesRelName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		dst        map[string]struct{}
		src        map[string]struct{}
		dstRel     string
		srcRel     string
		wantCols   []string
		wantDstRel string
	}{
		{
			name:       "merges into empty dst",
			dst:        map[string]struct{}{},
			src:        map[string]struct{}{"a": {}, "b": {}},
			dstRel:     "",
			srcRel:     "rel1",
			wantCols:   []string{"a", "b"},
			wantDstRel: "rel1",
		},
		{
			name:       "appends new columns to existing dst",
			dst:        map[string]struct{}{"x": {}},
			src:        map[string]struct{}{"y": {}},
			dstRel:     "existing",
			srcRel:     "newer",
			wantCols:   []string{"x", "y"},
			wantDstRel: "newer", // srcRel non-empty overrides dstRel
		},
		{
			name:       "empty srcRel preserves dstRel",
			dst:        map[string]struct{}{},
			src:        map[string]struct{}{"col": {}},
			dstRel:     "keep_me",
			srcRel:     "",
			wantCols:   []string{"col"},
			wantDstRel: "keep_me",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			dst := make(map[string]struct{})
			maps.Copy(dst, tt.dst)

			dstRel := tt.dstRel
			mergePhantomResults(dst, tt.src, &dstRel, tt.srcRel)

			for _, col := range tt.wantCols {
				if _, ok := dst[col]; !ok {
					t.Errorf("expected column %q in merged dst, got %v", col, dst)
				}
			}

			if dstRel != tt.wantDstRel {
				t.Errorf("expected dstRel=%q, got %q", tt.wantDstRel, dstRel)
			}
		})
	}
}

// ---------- analyzer.getFragment / resolveFragmentTypeName ----------

func TestAnalyzer_GetFragment(t *testing.T) {
	t.Parallel()

	frag := &ast.FragmentDefinition{
		Name:          "UserFields",
		TypeCondition: "users",
	}

	a := newAnalyzer(
		"db1",
		&ast.Schema{Types: map[string]*ast.Definition{}},
		nil,
		ast.Query,
		ast.FragmentDefinitionList{frag},
	)

	if got := a.getFragment("UserFields"); got != frag {
		t.Errorf("expected to find UserFields fragment, got %v", got)
	}

	if got := a.getFragment("Missing"); got != nil {
		t.Errorf("expected nil for missing fragment, got %v", got)
	}
}

func TestAnalyzer_ResolveFragmentTypeName(t *testing.T) {
	t.Parallel()

	frags := ast.FragmentDefinitionList{
		{Name: "WithType", TypeCondition: "users"},
		{Name: "NoType", TypeCondition: ""},
	}

	a := newAnalyzer(
		"db1",
		&ast.Schema{Types: map[string]*ast.Definition{}},
		nil,
		ast.Query,
		frags,
	)

	if got := a.resolveFragmentTypeName("WithType", "fallback"); got != "users" {
		t.Errorf("expected 'users', got %q", got)
	}

	if got := a.resolveFragmentTypeName("NoType", "fallback"); got != "fallback" {
		t.Errorf("expected fallback when fragment has no type condition, got %q", got)
	}

	if got := a.resolveFragmentTypeName("Missing", "fallback"); got != "" {
		t.Errorf("expected empty for missing fragment, got %q", got)
	}
}

// ---------- analyzer.getFieldReturnType / getFieldReturnTypeOnType ----------

func TestAnalyzer_GetFieldReturnType_HandlesEmptySchemaAndOperations(t *testing.T) {
	t.Parallel()

	queryRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "query_root",
		Fields: ast.FieldList{
			{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
		},
	}
	mutationRoot := &ast.Definition{
		Kind: ast.Object,
		Name: "mutation_root",
		Fields: ast.FieldList{
			{Name: "insert_users", Type: ast.NamedType("users", nil)},
		},
	}

	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"query_root":    queryRoot,
			"mutation_root": mutationRoot,
		},
		Query:    queryRoot,
		Mutation: mutationRoot,
	}

	tests := []struct {
		name   string
		opType ast.Operation
		field  *ast.Field
		schema *ast.Schema
		want   string
	}{
		{
			name:   "query field returns base type",
			opType: ast.Query,
			field:  &ast.Field{Name: "users"},
			schema: schema,
			want:   "users",
		},
		{
			name:   "mutation field returns base type",
			opType: ast.Mutation,
			field:  &ast.Field{Name: "insert_users"},
			schema: schema,
			want:   "users",
		},
		{
			name:   "subscription with no subscription root returns empty",
			opType: ast.Subscription,
			field:  &ast.Field{Name: "users"},
			schema: schema,
			want:   "",
		},
		{
			name:   "unknown field returns empty",
			opType: ast.Query,
			field:  &ast.Field{Name: "missing"},
			schema: schema,
			want:   "",
		},
		{
			name:   "nil schema returns empty",
			opType: ast.Query,
			field:  &ast.Field{Name: "users"},
			schema: nil,
			want:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a := newAnalyzer("db1", tt.schema, nil, tt.opType, nil)

			got := a.getFieldReturnType(tt.field)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestAnalyzer_GetFieldReturnTypeOnType(t *testing.T) {
	t.Parallel()

	schema := &ast.Schema{
		Types: map[string]*ast.Definition{
			"users": {
				Kind: ast.Object,
				Name: "users",
				Fields: ast.FieldList{
					{Name: "department", Type: ast.NamedType("departments", nil)},
				},
			},
		},
	}

	tests := []struct {
		name      string
		schema    *ast.Schema
		typeName  string
		fieldName string
		want      string
	}{
		{
			name:      "known type and field",
			schema:    schema,
			typeName:  "users",
			fieldName: "department",
			want:      "departments",
		},
		{
			name:      "unknown type",
			schema:    schema,
			typeName:  "missing",
			fieldName: "department",
			want:      "",
		},
		{
			name:      "unknown field on known type",
			schema:    schema,
			typeName:  "users",
			fieldName: "missing",
			want:      "",
		},
		{
			name:      "nil schema",
			schema:    nil,
			typeName:  "users",
			fieldName: "department",
			want:      "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a := newAnalyzer("db1", tt.schema, nil, ast.Query, nil)

			got := a.getFieldReturnTypeOnType(tt.typeName, tt.fieldName)
			if got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

// ---------- analyzer.collectFromSelectionSet ----------

// analyzerTestSchema builds a users -> department schema shared by the
// fragment-spread / inline-fragment branch tests.
func analyzerTestSchema() *ast.Schema {
	return &ast.Schema{
		Types: map[string]*ast.Definition{
			"users": {
				Kind: ast.Object,
				Name: "users",
				Fields: ast.FieldList{
					{Name: "id", Type: ast.NamedType("Int", nil)},
					{Name: "department_id", Type: ast.NamedType("Int", nil)},
					{Name: "department", Type: ast.NamedType("departments", nil)},
				},
			},
			"departments": {
				Kind: ast.Object,
				Name: "departments",
				Fields: ast.FieldList{
					{Name: "id", Type: ast.NamedType("Int", nil)},
					{Name: "name", Type: ast.NamedType("String", nil)},
				},
			},
		},
	}
}

func analyzerTestRelationship() *RelationshipMetadata {
	return &RelationshipMetadata{
		Name:              "department",
		SourceType:        "users",
		TargetConnector:   "db2",
		TargetTable:       "departments",
		TargetTableSchema: "public",
		JoinMapping:       map[string]string{"department_id": "id"},
		IsArray:           false,
		IsArrayAggregate:  false,
		IsRemote:          true,
		LHSFields:         nil,
		RemoteFieldPath:   nil,
	}
}

func TestCollectFromSelectionSet_DirectField(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer("db1", analyzerTestSchema(), []*RelationshipMetadata{rel}, ast.Query, nil)

	selSet := ast.SelectionSet{
		&ast.Field{Name: "id"},
		&ast.Field{
			Name:         "department",
			SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
		},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	neededPhantoms, relName := a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
	)

	if _, ok := neededPhantoms["department_id"]; !ok {
		t.Errorf("expected department_id phantom, got %v", neededPhantoms)
	}

	if relName != "department" {
		t.Errorf("expected relName=department, got %q", relName)
	}

	if len(result.RemoteQueries) != 1 {
		t.Fatalf("expected 1 RemoteQuery, got %d", len(result.RemoteQueries))
	}

	if result.RemoteQueries[0].Name != "department" {
		t.Errorf("expected RemoteQuery 'department', got %q", result.RemoteQueries[0].Name)
	}
}

func TestCollectFromSelectionSet_FragmentSpreadBranch(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()

	frag := &ast.FragmentDefinition{
		Name:          "UserFields",
		TypeCondition: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "id"},
			&ast.Field{
				Name:         "department",
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
			},
		},
	}

	a := newAnalyzer(
		"db1",
		analyzerTestSchema(),
		[]*RelationshipMetadata{rel},
		ast.Query,
		ast.FragmentDefinitionList{frag},
	)

	selSet := ast.SelectionSet{
		&ast.FragmentSpread{Name: "UserFields", Definition: frag},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	neededPhantoms, relName := a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
	)

	if _, ok := neededPhantoms["department_id"]; !ok {
		t.Errorf(
			"expected department_id phantom propagated from fragment spread, got %v",
			neededPhantoms,
		)
	}

	if relName != "department" {
		t.Errorf("expected relName=department, got %q", relName)
	}

	if len(result.RemoteQueries) != 1 {
		t.Fatalf("expected 1 RemoteQuery propagated, got %d", len(result.RemoteQueries))
	}
}

func TestCollectFromSelectionSet_FragmentSpreadMissingFragmentIgnored(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer(
		"db1",
		analyzerTestSchema(),
		[]*RelationshipMetadata{rel},
		ast.Query,
		nil, // no fragments registered
	)

	selSet := ast.SelectionSet{
		&ast.FragmentSpread{Name: "Missing"},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	neededPhantoms, relName := a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
	)

	if len(neededPhantoms) != 0 {
		t.Errorf("expected no phantoms for missing fragment, got %v", neededPhantoms)
	}

	if relName != "" {
		t.Errorf("expected empty relName, got %q", relName)
	}

	if len(result.RemoteQueries) != 0 {
		t.Errorf("expected no RemoteQueries, got %d", len(result.RemoteQueries))
	}
}

func TestCollectFromSelectionSet_InlineFragmentBranch(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer("db1", analyzerTestSchema(), []*RelationshipMetadata{rel}, ast.Query, nil)

	selSet := ast.SelectionSet{
		&ast.InlineFragment{
			TypeCondition: "users",
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "id"},
				&ast.Field{
					Name:         "department",
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
				},
			},
		},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	neededPhantoms, relName := a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
	)

	if _, ok := neededPhantoms["department_id"]; !ok {
		t.Errorf(
			"expected department_id phantom propagated from inline fragment, got %v",
			neededPhantoms,
		)
	}

	if relName != "department" {
		t.Errorf("expected relName=department, got %q", relName)
	}
}

func TestCollectFromSelectionSet_InlineFragmentWithoutTypeConditionUsesFallback(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer("db1", analyzerTestSchema(), []*RelationshipMetadata{rel}, ast.Query, nil)

	// Inline fragment without TypeCondition inherits the enclosing typeName.
	selSet := ast.SelectionSet{
		&ast.InlineFragment{
			TypeCondition: "",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name:         "department",
					SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
				},
			},
		},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	_, relName := a.collectFromSelectionSet(selSet, "users", jsonpath.Parse("users"), result)

	if relName != "department" {
		t.Errorf("expected fallback type to resolve relationship, got relName=%q", relName)
	}

	if len(result.RemoteQueries) != 1 {
		t.Fatalf("expected 1 RemoteQuery using fallback type, got %d", len(result.RemoteQueries))
	}
}

// ---------- analyzer.analyzeField ----------

func TestAnalyzeField_NoSelectionSetIsNoOp(t *testing.T) {
	t.Parallel()

	a := newAnalyzer("db1", analyzerTestSchema(), nil, ast.Query, nil)

	field := &ast.Field{
		Name:         "id",
		SelectionSet: nil,
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	a.analyzeField(field, "users", jsonpath.Parse("users"), result)

	if len(result.PhantomFields) != 0 {
		t.Errorf("expected no phantom fields, got %d", len(result.PhantomFields))
	}

	if len(result.RemoteQueries) != 0 {
		t.Errorf("expected no remote queries, got %d", len(result.RemoteQueries))
	}
}

func TestAnalyzeField_SkipsPhantomWhenColumnAlreadySelected(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer("db1", analyzerTestSchema(), []*RelationshipMetadata{rel}, ast.Query, nil)

	field := &ast.Field{
		Name: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "id"},
			&ast.Field{Name: "department_id"}, // already selected -> no phantom
			&ast.Field{
				Name:         "department",
				SelectionSet: ast.SelectionSet{&ast.Field{Name: "name"}},
			},
		},
	}

	result := &analysisResult{
		PhantomFields: []*PhantomFieldSpec{},
		RemoteQueries: []*RemoteQueryPlan{},
	}

	a.analyzeField(field, "users", jsonpath.Parse("users"), result)

	if len(result.PhantomFields) != 0 {
		t.Errorf(
			"expected no phantom fields when join column already selected, got %+v",
			result.PhantomFields,
		)
	}

	if len(result.RemoteQueries) != 1 {
		t.Errorf("expected 1 remote query, got %d", len(result.RemoteQueries))
	}

	// Source phantom should be nil since no phantom spec was generated.
	if result.RemoteQueries[0].SourcePhantomFields != nil {
		t.Errorf(
			"expected SourcePhantomFields=nil, got %+v",
			result.RemoteQueries[0].SourcePhantomFields,
		)
	}
}

// ---------- analyzer.collectSelectedFields ----------

func TestAnalyzer_CollectSelectedFields_ExpandsFragments(t *testing.T) {
	t.Parallel()

	frag := &ast.FragmentDefinition{
		Name:          "UserFields",
		TypeCondition: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "email", Alias: "user_email"},
		},
	}

	a := newAnalyzer(
		"db1",
		analyzerTestSchema(),
		nil,
		ast.Query,
		ast.FragmentDefinitionList{frag},
	)

	field := &ast.Field{
		Name: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "id"},
			&ast.FragmentSpread{Name: "UserFields"},
			&ast.InlineFragment{
				TypeCondition: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "name"},
				},
			},
		},
	}

	got := a.collectSelectedFields(field)

	for _, want := range []string{"id", "user_email", "name"} {
		if _, ok := got[want]; !ok {
			t.Errorf("expected %q in selected fields, got %v", want, got)
		}
	}
}
