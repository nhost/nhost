package introspection

import "fmt"

// Volatility represents PostgreSQL function volatility classification.
type Volatility string

const (
	// VolatilityImmutable marks a function whose result depends only on its
	// arguments. Safe to memoise and to call from query contexts.
	VolatilityImmutable Volatility = "IMMUTABLE"
	// VolatilityStable marks a function whose result does not change within
	// a single statement for the same arguments. Safe to call from query
	// contexts but not memoisable across statements.
	VolatilityStable Volatility = "STABLE"
	// VolatilityVolatile marks a function whose result can change between
	// calls with the same arguments (e.g. it reads or modifies state).
	// Must be invoked from mutation contexts.
	VolatilityVolatile Volatility = "VOLATILE"
)

// FunctionArgument represents a function parameter.
type FunctionArgument struct {
	// Name is the argument name; empty for positional-only arguments.
	Name string
	// Type is the PostgreSQL type name of the argument.
	Type string
	// HasDefault is true when the argument has a default value and may be
	// omitted by callers.
	HasDefault bool
}

// GraphQLName returns the GraphQL input-field name for the argument.
// Named arguments use their SQL name, while positional-only arguments receive
// Hasura-compatible names such as arg_1 based on their zero-based position.
func (a FunctionArgument) GraphQLName(index int) string {
	if a.Name != "" {
		return a.Name
	}

	return fmt.Sprintf("arg_%d", index+1)
}

// FunctionReturnType represents what the function returns.
type FunctionReturnType struct {
	// Type is the base type name returned by the function.
	Type string
	// IsSetOf is true when the function is declared SETOF and yields
	// multiple rows.
	IsSetOf bool
	// TableSchema is the schema of the returned table type, if the
	// function returns a table type; empty otherwise.
	TableSchema string
	// TableName is the name of the returned table type, if the function
	// returns a table type; empty otherwise.
	TableName string
}

// IsTableType returns true if the function returns a table type.
func (f FunctionReturnType) IsTableType() bool {
	return f.TableSchema != "" && f.TableName != ""
}

// PostgreSQLType identifies a catalog type without relying on search_path.
// OID is kept for exact row-type matching; Schema and Name can be safely
// quoted separately when constructing a PostgreSQL type reference.
type PostgreSQLType struct {
	OID    uint32
	Schema string
	Name   string
}

// ComputedFunctionArgument is a catalog argument in declaration order.
// Position counts OUT/TABLE arguments too, whereas HasDefault counts only
// input-capable arguments from the end of the input list.
type ComputedFunctionArgument struct {
	Type PostgreSQLType
	Name string
	// Mode is the pg_proc argument mode: i=IN, o=OUT, b=INOUT,
	// v=VARIADIC, t=TABLE output.
	Mode       string
	Position   int
	HasDefault bool
}

// ComputedFunction is a unique, row-bound PostgreSQL signature. Unlike the
// tracked-root Function it retains all argument modes and qualified types.
type ComputedFunction struct {
	OID uint32
	// Schema and Name are the resolved pg_proc identity, including the
	// public schema for a metadata reference that omitted its schema.
	Schema       string
	Name         string
	Arguments    []ComputedFunctionArgument
	RowArgument  int // zero-based position among all catalog arguments
	ReturnType   PostgreSQLType
	ReturnSet    bool
	ReturnRelOID uint32
	Volatility   Volatility
}

// ComputedFunctionLookup retains a per-field invalid signature instead of
// making a bad field prevent introspection of the remaining source.
type ComputedFunctionLookup struct {
	Function *ComputedFunction
	Reason   string
}

// Function represents introspected function metadata.
// The schema and name are the components of the "schema.name" key in
// Objects.Functions.
type Function struct {
	Arguments  []FunctionArgument
	ReturnType FunctionReturnType
	Volatility Volatility
}
