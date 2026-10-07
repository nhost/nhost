package planner

import (
	"errors"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/vektah/gqlparser/v2/ast"
)

// ErrSchemaForRoleNotFound is returned by [QueryPlanner.Plan] when the role
// has no validated schema in the planner's schema map. Callers should match
// on this sentinel with [errors.Is] rather than checking for a nil plan.
var ErrSchemaForRoleNotFound = errors.New("planner: no schema for role")

// QueryPlanner analyzes GraphQL operations and produces execution plans.
// It detects remote relationships and determines what phantom fields are needed,
// but leaves query building to the connectors.
type QueryPlanner struct {
	// schemas maps role -> validated schema
	schemas map[string]*ast.Schema

	// fieldToConnector maps schemamerge.FieldKey(op, fieldName) -> connector name
	fieldToConnector map[string]string

	// typeToConnectors maps type name -> connector names
	typeToConnectors map[string][]string

	// relationshipsByConnector maps connector -> relationships
	relationshipsByConnector map[string][]*RelationshipMetadata
}

// New creates a new QueryPlanner.
func New(
	schemas map[string]*ast.Schema,
	fieldToConnector map[string]string,
	typeToConnectors map[string][]string,
	connectorRelationships map[string][]*RelationshipMetadata,
) *QueryPlanner {
	return &QueryPlanner{
		schemas:                  schemas,
		fieldToConnector:         fieldToConnector,
		typeToConnectors:         typeToConnectors,
		relationshipsByConnector: connectorRelationships,
	}
}

// Plan analyzes a GraphQL operation and produces an execution plan.
// The plan describes:
// - What each connector should execute (with phantom field hints)
// - What remote relationships need to be resolved
// - The order of operations (dependencies).
// variables are the coerced request variables used to evaluate selection directives.
func (p *QueryPlanner) Plan(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	role string,
	variables map[string]any,
) (*QueryPlan, error) {
	schema := p.schemas[role]
	if schema == nil {
		return nil, ErrSchemaForRoleNotFound
	}

	const initialQueryCap = 2

	plan := &QueryPlan{
		PrimaryQueries: make([]*PrimaryQuery, 0, initialQueryCap),
		RemoteQueries:  make([]*RemoteQueryPlan, 0, initialQueryCap),
	}

	fieldsByConnector := p.groupFieldsByConnector(operation)

	for connectorName, fields := range fieldsByConnector {
		primary, remotes := p.planConnector(
			operation, fields, connectorName, schema, fragments, variables,
		)
		plan.PrimaryQueries = append(plan.PrimaryQueries, primary)
		plan.RemoteQueries = append(plan.RemoteQueries, remotes...)
	}

	return plan, nil
}

func (p *QueryPlanner) planConnector(
	operation *ast.OperationDefinition,
	fields []ast.Selection,
	connectorName string,
	schema *ast.Schema,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) (*PrimaryQuery, []*RemoteQueryPlan) {
	analyzer := newAnalyzer(
		connectorName, schema, nil, operation.Operation, fragments,
	)
	for owner, relationships := range p.relationshipsByConnector {
		analyzer.relationshipLookup[owner] = make(map[string]*RelationshipMetadata)
		for _, rel := range relationships {
			if transform.FieldReturnTypeOnType(schema, rel.SourceType, rel.Name) != "" {
				analyzer.relationshipLookup[owner][rel.SourceType+"."+rel.Name] = rel
			}
		}
	}

	analyzer.variables = variables
	subOp := transform.BuildSubOperation(operation, fields)
	analysis := analyzer.analyzeOperation(subOp)

	transformer := transform.NewTransformer(
		schema, toRemoteRelationships(p.relationshipsByConnector[connectorName]),
		connectorName, p.typeToConnectors,
	)
	transformResult := transformer.Transform(subOp, fragments)

	// Phantoms under a remote result belong in that result's target operation,
	// not the initial connector's cleaned operation.
	var primaryPhantoms []*PhantomFieldSpec
	for _, spec := range analysis.PhantomFields {
		if !isUnderRemoteResult(spec.Path, analysis.RemoteQueries) {
			primaryPhantoms = append(primaryPhantoms, spec)
		}
	}

	transform.InjectPhantomFields(
		transformResult.CleanOperation,
		toPhantomSpecs(primaryPhantoms),
		transformResult.CleanFragments,
	)

	for _, remote := range analysis.RemoteQueries {
		remote.Selection = prepareRemoteSelection(remote, analysis, schema, fragments, variables)
	}

	return &PrimaryQuery{
		Connector:      connectorName,
		CleanOperation: transformResult.CleanOperation,
		CleanFragments: transformResult.CleanFragments,
		PhantomFields:  primaryPhantoms,
	}, analysis.RemoteQueries
}

func isUnderRemoteResult(path []string, remotes []*RemoteQueryPlan) bool {
	for _, remote := range remotes {
		output := remote.SourcePath.Child(remote.OutputField)
		if pathHasPrefix(path, output) {
			return true
		}
	}

	return false
}

func pathHasPrefix(path, prefix []string) bool {
	if len(path) < len(prefix) {
		return false
	}

	for i, part := range prefix {
		if path[i] != part {
			return false
		}
	}

	return true
}

// groupFieldsByConnector groups root-level selections by their owning connector.
func (p *QueryPlanner) groupFieldsByConnector(
	op *ast.OperationDefinition,
) map[string][]ast.Selection {
	result := make(map[string][]ast.Selection)

	for _, sel := range op.SelectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		connName := p.fieldToConnector[schemamerge.FieldKey(op.Operation, field.Name)]
		if connName == "" {
			continue
		}

		result[connName] = append(result[connName], sel)
	}

	return result
}

// toRemoteRelationships filters relationships down to the remote ones and
// converts them into the minimal descriptor [transform.NewTransformer] needs.
func toRemoteRelationships(rels []*RelationshipMetadata) []transform.RemoteRelationship {
	out := make([]transform.RemoteRelationship, 0, len(rels))
	for _, r := range rels {
		if !r.IsRemote {
			continue
		}

		out = append(out, transform.RemoteRelationship{
			SourceType: r.SourceType,
			Name:       r.Name,
		})
	}

	return out
}

// toPhantomSpecs converts planner [PhantomFieldSpec]s into the minimal
// [transform.PhantomSpec] shape used for injection.
func toPhantomSpecs(specs []*PhantomFieldSpec) []transform.PhantomSpec {
	out := make([]transform.PhantomSpec, 0, len(specs))
	for _, s := range specs {
		out = append(out, transform.PhantomSpec{
			Path:    s.Path,
			Fields:  s.Fields,
			Aliases: s.Aliases,
		})
	}

	return out
}

// GetPrimaryQueryForConnector returns the primary query for a specific connector.
func (qp *QueryPlan) GetPrimaryQueryForConnector(connector string) *PrimaryQuery {
	for _, pq := range qp.PrimaryQueries {
		if pq.Connector == connector {
			return pq
		}
	}

	return nil
}

// HasRemoteQueries returns true if the plan has any remote relationships.
func (qp *QueryPlan) HasRemoteQueries() bool {
	return len(qp.RemoteQueries) > 0
}
