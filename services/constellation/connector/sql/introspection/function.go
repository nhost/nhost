package introspection

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

// Function represents introspected function metadata.
// The schema and name are the components of the "schema.name" key in
// Objects.Functions.
type Function struct {
	Arguments  []FunctionArgument
	ReturnType FunctionReturnType
	Volatility Volatility
}
