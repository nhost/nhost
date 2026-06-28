// Package planner analyzes a parsed GraphQL operation and produces a
// [QueryPlan] describing how to execute it across one or more connectors.
// It is the compile-time half of the controller's execution pipeline: the
// resolver layer consumes the plan at run time to drive primary execution
// and remote-relationship stitching.
//
// Integration. [QueryPlanner.Plan] is invoked from controller.Resolve (see
// controller/resolve.go) immediately after the request has been parsed and
// validated against the role's schema. The returned *QueryPlan is then
// passed to controller/resolver, which executes each PrimaryQuery against
// its owning connector, removes phantom fields from intermediate results,
// and fetches RemoteQueries to stitch cross-connector relationships back
// into the response. The planner itself performs no I/O and never touches
// the connectors directly.
//
// Phases. Planning runs in two phases per connector:
//
//  1. Analysis (this package, analyzer.go) walks the operation, groups
//     root fields by their owning connector, detects remote-relationship
//     fields against the configured [RelationshipMetadata], and records
//     which join columns each parent selection set must expose.
//  2. Sub-operation transform (subpackage controller/planner/transform)
//     produces the clean per-connector AST: it strips relationship fields,
//     filters fragments by connector type ownership, removes spreads that
//     became empty after stripping, and injects phantom fields at the
//     paths the analyzer identified.
//
// Phantom fields. When the analyzer detects a remote relationship on a
// selection set, the join columns required to resolve it may not have
// been requested by the client. The planner records these as
// [PhantomFieldSpec] entries on the owning [PrimaryQuery]; transform
// injects them into the clean operation so the connector returns them,
// and the resolver removes them from the final response after stitching.
package planner

import (
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// ResolverKind names a remote-relationship resolution strategy.
type ResolverKind string

const (
	// ResolverKindDatabase resolves the remote side of a relationship via a
	// regular database query against the target connector (db→db, rs→db).
	ResolverKindDatabase ResolverKind = "database"

	// ResolverKindSchema resolves the remote side of a relationship by issuing
	// a GraphQL query against a remote schema connector (db→rs).
	ResolverKindSchema ResolverKind = "schema"
)

// QueryPlan represents a fully analyzed query ready for execution.
// It contains information about what each connector should query
// and what remote relationships need to be resolved.
type QueryPlan struct {
	// PrimaryQueries are the initial queries to execute against each connector.
	// These are executed first, before any remote relationship resolution.
	PrimaryQueries []*PrimaryQuery

	// RemoteQueries are the remote relationships to resolve after primary queries.
	// They are ordered by dependency - queries with no dependencies come first.
	RemoteQueries []*RemoteQueryPlan
}

// PrimaryQuery describes what a connector should execute.
type PrimaryQuery struct {
	// Connector is the name of the connector to execute against.
	Connector string

	// CleanOperation is the operation with relationship fields stripped.
	// This is what connectors should actually execute.
	CleanOperation *ast.OperationDefinition

	// CleanFragments are the fragments with relationship fields stripped.
	// Fragments whose types don't exist in the connector's schema are filtered out.
	CleanFragments ast.FragmentDefinitionList

	// PhantomFields are fields that need to be added for relationship resolution.
	// The connector should inject these into its query.
	PhantomFields []*PhantomFieldSpec
}

// PhantomFieldSpec describes phantom fields to inject at a specific path.
type PhantomFieldSpec struct {
	// Path is where the phantom fields should be added (e.g., "users.profile").
	Path jsonpath.Path

	// Fields are the field names to add (e.g., ["user_id", "department_id"]).
	Fields []string

	// Aliases maps field names to the internal response key that should be used
	// when injecting the phantom field. An absent entry means the field can be
	// injected without an alias.
	Aliases map[string]string

	// ForRelationship identifies which relationship needs these phantom fields.
	ForRelationship string
}

// RemoteQueryPlan describes a remote relationship to resolve.
type RemoteQueryPlan struct {
	// Name is the relationship name (for identification/logging).
	Name string

	// SourceConnector is where the parent data comes from.
	SourceConnector string

	// SourcePath is the path to the parent data in results (e.g., "games.homeTeam").
	SourcePath jsonpath.Path

	// TargetConnector is where to fetch related data from.
	TargetConnector string

	// TargetTable is the table/type to query in the target connector.
	TargetTable string

	// TargetTableSchema is the database schema of the target table (e.g., "public").
	// Used together with TargetTable to resolve the correct GraphQL type name.
	TargetTableSchema string

	// JoinMapping maps source columns to target columns (e.g., {"departmentId": "id"}).
	JoinMapping map[string]string

	// IsArray indicates if this is an array relationship (vs object).
	IsArray bool

	// IsArrayAggregate indicates this is the aggregate variant of an array
	// relationship (e.g. "departments_aggregate"). Always set together with
	// IsArray=true. The resolver dispatches these through a grouped-aggregate
	// path against the target connector instead of the normal one.
	IsArrayAggregate bool

	// OutputField is the field name where results should be placed.
	OutputField string

	// Selection is the original field selection (what the client requested)
	// before phantom-field injection and relationship stripping. The resolver
	// uses it to reconstruct the remote operation; the planner does not mutate it.
	Selection *ast.Field

	// SourcePhantomFields are phantom fields added to the source query.
	// These should be removed after stitching.
	SourcePhantomFields *PhantomFieldSpec

	// ResolverType indicates which resolver strategy to use.
	// For database relationships (db→db, rs→db): use ResolverKindDatabase.
	// For schema relationships (db→rs): use ResolverKindSchema.
	ResolverType ResolverKind

	// LHSFields are the source fields used for joining (for schema relationships).
	// These are the field names on the source type that provide join values.
	LHSFields []string

	// RemoteFieldPath is the path through the remote schema (for schema relationships).
	// Each entry specifies a field name and its arguments.
	RemoteFieldPath []RemoteFieldPathEntry
}

// RemoteFieldPathEntry describes a step in a remote schema field path.
// Used for db→rs relationships where we need to navigate through the remote schema.
type RemoteFieldPathEntry struct {
	// FieldName is the remote field name at this step.
	FieldName string

	// Arguments maps argument names to values.
	// Values starting with "$" reference source fields (e.g., "$user_id").
	Arguments map[string]string
}

// RelationshipMetadata describes a relationship configured on a connector.
// Connectors provide this metadata so the planner can detect relationships.
type RelationshipMetadata struct {
	// Name is the relationship field name.
	Name string

	// SourceType is the GraphQL type that has this relationship.
	SourceType string

	// TargetConnector is the connector to query for related data.
	TargetConnector string

	// TargetTable is the table/type in the target connector.
	TargetTable string

	// TargetTableSchema is the database schema of the target table (e.g., "public").
	TargetTableSchema string

	// JoinMapping maps source columns to target columns.
	JoinMapping map[string]string

	// IsArray indicates if this is an array relationship.
	IsArray bool

	// IsArrayAggregate marks this metadata as the aggregate variant of an
	// array relationship (a "<rel>_aggregate" field exposed alongside the
	// array field on the parent type). Always set together with IsArray=true.
	IsArrayAggregate bool

	// IsRemote indicates this crosses connector boundaries.
	IsRemote bool

	// LHSFields are the source fields used for joining (for db→rs relationships).
	// These are the field names on the source type that provide join values.
	LHSFields []string

	// RemoteFieldPath is the path through the remote schema (for db→rs relationships).
	// Each entry specifies a field name and its arguments.
	RemoteFieldPath []RemoteFieldPathEntry
}

// avgPhantomsPerPrimaryQuery is a heuristic capacity hint for
// [QueryPlan.AllPhantomFieldSpecs]: typical multi-connector plans have on
// the order of one or two phantom field specs per primary query.
const avgPhantomsPerPrimaryQuery = 2

// AllPhantomFieldSpecs returns all phantom field specs from all primary queries.
func (qp *QueryPlan) AllPhantomFieldSpecs() []*PhantomFieldSpec {
	all := make([]*PhantomFieldSpec, 0, len(qp.PrimaryQueries)*avgPhantomsPerPrimaryQuery)
	for _, pq := range qp.PrimaryQueries {
		all = append(all, pq.PhantomFields...)
	}

	return all
}
