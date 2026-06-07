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

	// fieldToConnector maps role -> schemamerge.FieldKey(op, fieldName) -> connector name.
	fieldToConnector map[string]map[string]string

	// typeToConnectors maps role -> type name -> connector names.
	typeToConnectors map[string]map[string][]string

	// relationshipsByConnector maps connector -> relationships
	relationshipsByConnector map[string][]*RelationshipMetadata
}

// New creates a new QueryPlanner.
func New(
	schemas map[string]*ast.Schema,
	fieldToConnector map[string]map[string]string,
	typeToConnectors map[string]map[string][]string,
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
func (p *QueryPlanner) Plan(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	role string,
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

	fieldsByConnector := p.groupFieldsByConnector(operation, role)

	for connectorName, fields := range fieldsByConnector {
		relationships := p.relationshipsByConnector[connectorName]

		analyzer := newAnalyzer(
			connectorName,
			schema,
			relationships,
			operation.Operation,
			fragments,
		)

		subOp := transform.BuildSubOperation(operation, fields)
		analysis := analyzer.analyzeOperation(subOp)

		transformer := transform.NewTransformer(
			schema,
			toRemoteRelationships(relationships),
			connectorName,
			p.typeToConnectors[role],
		)
		transformResult := transformer.Transform(subOp, fragments)

		// Phantom fields are injected into the clean operation, which is already
		// a clone (safe to mutate).
		transform.InjectPhantomFields(
			transformResult.CleanOperation,
			toPhantomSpecs(analysis.PhantomFields),
		)

		plan.PrimaryQueries = append(plan.PrimaryQueries, &PrimaryQuery{
			Connector:      connectorName,
			CleanOperation: transformResult.CleanOperation,
			CleanFragments: transformResult.CleanFragments,
			PhantomFields:  analysis.PhantomFields,
		})

		plan.RemoteQueries = append(plan.RemoteQueries, analysis.RemoteQueries...)
	}

	return plan, nil
}

// groupFieldsByConnector groups root-level selections by their owning connector.
func (p *QueryPlanner) groupFieldsByConnector(
	op *ast.OperationDefinition,
	role string,
) map[string][]ast.Selection {
	result := make(map[string][]ast.Selection)
	fieldToConnector := p.fieldToConnector[role]

	for _, sel := range op.SelectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		connName := fieldToConnector[schemamerge.FieldKey(op.Operation, field.Name)]
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
