package planner

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

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

func assertDepartmentSource(t *testing.T, result *analysisResult) {
	t.Helper()

	source := result.sources["users\x00users"]
	if source == nil || source.path.String() != "users" || source.sourceType != "users" ||
		source.phantomForRel != "department" {
		t.Fatalf("expected users relationship source, got %+v", source)
	}

	if _, ok := source.needed["department_id"]; !ok {
		t.Errorf("expected department_id phantom, got %v", source.needed)
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

	a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
		jsonpath.Parse("users"),
		selSet,
	)

	assertDepartmentSource(t, result)

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

	a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
		jsonpath.Parse("users"),
		selSet,
	)

	assertDepartmentSource(t, result)

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

	a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
		jsonpath.Parse("users"),
		selSet,
	)

	if len(result.sources) != 0 {
		t.Errorf("expected no sources for missing fragment, got %v", result.sources)
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

	a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
		jsonpath.Parse("users"),
		selSet,
	)

	assertDepartmentSource(t, result)
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

	a.collectFromSelectionSet(
		selSet,
		"users",
		jsonpath.Parse("users"),
		result,
		jsonpath.Parse("users"),
		selSet,
	)
	assertDepartmentSource(t, result)

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
	a.finishPhantoms(result)

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
	a.finishPhantoms(result)

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

func TestAnalyzeField_AliasedUnrelatedFieldDoesNotSuppressPhantom(t *testing.T) {
	t.Parallel()

	rel := analyzerTestRelationship()
	a := newAnalyzer("db1", analyzerTestSchema(), []*RelationshipMetadata{rel}, ast.Query, nil)

	field := &ast.Field{
		Name: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "id", Alias: "department_id"},
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
	a.finishPhantoms(result)

	if len(result.PhantomFields) != 1 {
		t.Fatalf("expected one phantom field spec, got %+v", result.PhantomFields)
	}

	spec := result.PhantomFields[0]
	if len(spec.Fields) != 1 || spec.Fields[0] != "department_id" {
		t.Fatalf("expected department_id phantom, got %+v", spec.Fields)
	}

	if got := spec.Aliases["department_id"]; got != "_constellation_phantom_department_id" {
		t.Fatalf("expected internal alias for colliding phantom, got %q", got)
	}

	if result.RemoteQueries[0].SourcePhantomFields != spec {
		t.Fatalf("expected remote query to reference source phantom spec")
	}
}

// ---------- analyzer.collectOwnResponseKeyFieldsForType / collectResponseKeys ----------

func TestAnalyzer_CollectOwnResponseKeyFieldsForType_ExpandsCompatibleFragments(
	t *testing.T,
) {
	t.Parallel()

	frag := &ast.FragmentDefinition{
		Name:          "UserFields",
		TypeCondition: "Node",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "email", Alias: "user_email"},
			&ast.Field{Name: "created_at", Alias: "created_at"},
		},
	}
	sibling := &ast.FragmentDefinition{
		Name:          "OtherFields",
		TypeCondition: "other",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "unrelated"},
		},
	}

	schema := analyzerTestSchema()
	schema.PossibleTypes = map[string][]*ast.Definition{
		"Node": {{Name: "users"}, {Name: "other"}},
	}
	a := newAnalyzer(
		"db1",
		schema,
		nil,
		ast.Query,
		ast.FragmentDefinitionList{frag, sibling},
	)

	field := &ast.Field{
		Name: "users",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "id"},
			&ast.FragmentSpread{Name: "UserFields"},
			&ast.FragmentSpread{Name: "OtherFields"},
			&ast.InlineFragment{
				TypeCondition: "users",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "name"},
				},
			},
		},
	}

	ownResponseKeys := make(map[string]struct{})
	a.collectOwnResponseKeyFieldsForType(field.SelectionSet, "users", ownResponseKeys)

	for _, want := range []string{"id", "created_at", "name"} {
		if _, ok := ownResponseKeys[want]; !ok {
			t.Errorf("expected %q in own-response-key fields, got %v", want, ownResponseKeys)
		}
	}

	for _, unwanted := range []string{"email", "user_email", "unrelated"} {
		if _, ok := ownResponseKeys[unwanted]; ok {
			t.Errorf(
				"did not expect %q in own-response-key fields, got %v",
				unwanted,
				ownResponseKeys,
			)
		}
	}

	responseKeys := make(map[string]struct{})
	a.collectResponseKeysFromSelections(field.SelectionSet, responseKeys)

	for _, want := range []string{"id", "user_email", "created_at", "name", "unrelated"} {
		if _, ok := responseKeys[want]; !ok {
			t.Errorf("expected %q in response keys, got %v", want, responseKeys)
		}
	}
}
