package hasura

import (
	"bytes"
	"context"
	stdjson "encoding/json"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
)

// errUnexpectedForeignKeyToken signals that foreign_key_constraint_on carried
// a JSON token that is none of the four supported shapes (string, array of
// strings, single-column object, composite-columns object).
var errUnexpectedForeignKeyToken = errors.New(
	"foreign_key_constraint_on: expected string, array, or object",
)

// errForeignKeyListEntryNotString signals that one of the entries inside the
// array form of foreign_key_constraint_on was not a string. The YAML and JSON
// paths both surface this — a permissive "drop non-strings" policy would mask
// typos in real-world metadata.
var errForeignKeyListEntryNotString = errors.New(
	"foreign_key_constraint_on: list entry is not a string",
)

const permissionAllColumns = "*"

var (
	errPermissionColumnsStringNotWildcard = errors.New(
		"permission columns string must be '*'",
	)
	errPermissionColumnsListEntryNotString = errors.New(
		"permission columns list entry is not a string",
	)
	errUnexpectedPermissionColumnsToken = errors.New(
		"permission columns: expected '*', array, or null",
	)
)

// TableMetadata is the Hasura representation of a tracked table.
type TableMetadata struct {
	Table               TableSource          `json:"table"                          yaml:"table"`
	IsEnum              bool                 `json:"is_enum,omitzero"               yaml:"is_enum,omitempty"`
	Configuration       TableConfiguration   `json:"configuration"                  yaml:"configuration,omitempty"`
	ObjectRelationships []ObjectRelationship `json:"object_relationships,omitempty" yaml:"object_relationships,omitempty"`
	ArrayRelationships  []ArrayRelationship  `json:"array_relationships,omitempty"  yaml:"array_relationships,omitempty"`
	RemoteRelationships []RemoteRelationship `json:"remote_relationships,omitempty" yaml:"remote_relationships,omitempty"`
	SelectPermissions   []SelectPermission   `json:"select_permissions,omitempty"   yaml:"select_permissions,omitempty"`
	InsertPermissions   []InsertPermission   `json:"insert_permissions,omitempty"   yaml:"insert_permissions,omitempty"`
	UpdatePermissions   []UpdatePermission   `json:"update_permissions,omitempty"   yaml:"update_permissions,omitempty"`
	DeletePermissions   []DeletePermission   `json:"delete_permissions,omitempty"   yaml:"delete_permissions,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UnmarshalYAML handles entries that may be `!include <path>` directives in
// addition to inline data. It uses the context-aware variant so the include
// base directory can be threaded through the decoder without package-level
// globals.
func (t *TableMetadata) UnmarshalYAML(ctx context.Context, unmarshal func(any) error) error {
	var includeStr string
	if err := unmarshal(&includeStr); err == nil {
		if path, ok := parseIncludePath(includeStr); ok {
			return loadIncludedFile(ctx, path, t)
		}
	}

	// tableAlias drops the custom UnmarshalYAML so the default decoder runs.
	type tableAlias TableMetadata

	var alias tableAlias
	if err := unmarshal(&alias); err != nil {
		return fmt.Errorf("unmarshaling table metadata: %w", err)
	}

	*t = TableMetadata(alias)
	t.convertRemoteRelationships()

	return nil
}

// TableSource identifies a table by schema-qualified name.
type TableSource struct {
	Name   string `json:"name"   yaml:"name"`
	Schema string `json:"schema" yaml:"schema"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ColumnConfig overrides the GraphQL name a SQL column is exposed under.
type ColumnConfig struct {
	CustomName string `json:"custom_name" yaml:"custom_name"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// CustomRootFields overrides the default GraphQL field names generated for a
// table's CRUD operations.
type CustomRootFields struct {
	Delete          string `json:"delete,omitempty"           yaml:"delete"`
	DeleteByPk      string `json:"delete_by_pk,omitempty"     yaml:"delete_by_pk"`
	Insert          string `json:"insert,omitempty"           yaml:"insert"`
	InsertOne       string `json:"insert_one,omitempty"       yaml:"insert_one"`
	Select          string `json:"select,omitempty"           yaml:"select"`
	SelectAggregate string `json:"select_aggregate,omitempty" yaml:"select_aggregate"`
	SelectByPk      string `json:"select_by_pk,omitempty"     yaml:"select_by_pk"`
	SelectStream    string `json:"select_stream,omitempty"    yaml:"select_stream"`
	Update          string `json:"update,omitempty"           yaml:"update"`
	UpdateByPk      string `json:"update_by_pk,omitempty"     yaml:"update_by_pk"`
	UpdateMany      string `json:"update_many,omitempty"      yaml:"update_many"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// TableConfiguration bundles per-table GraphQL customisations: column
// rename map, the GraphQL type name override, and the root-field overrides.
type TableConfiguration struct {
	ColumnConfig     map[string]ColumnConfig `json:"column_config,omitempty" yaml:"column_config,omitempty"`
	CustomName       string                  `json:"custom_name,omitempty"   yaml:"custom_name,omitempty"`
	CustomRootFields CustomRootFields        `json:"custom_root_fields"      yaml:"custom_root_fields,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// SelectPermission binds a role to its select-permission configuration.
type SelectPermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission SelectPermissionConfig `json:"permission" yaml:"permission"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// InsertPermission binds a role to its insert-permission configuration.
type InsertPermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission InsertPermissionConfig `json:"permission" yaml:"permission"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UpdatePermission binds a role to its update-permission configuration.
type UpdatePermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission UpdatePermissionConfig `json:"permission" yaml:"permission"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// DeletePermission binds a role to its delete-permission configuration.
type DeletePermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission DeletePermissionConfig `json:"permission" yaml:"permission"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// PermissionExpression is a Hasura boolean expression or preset map. Its JSON
// unmarshaler preserves number tokens as json.Number instead of float64 so
// large integer metadata literals are not rounded before native conversion.
type PermissionExpression map[string]any

// UnmarshalJSON decodes permission expressions with exact JSON number tokens.
func (p *PermissionExpression) UnmarshalJSON(data []byte) error {
	if bytes.Equal(data, []byte("null")) {
		*p = nil

		return nil
	}

	dec := stdjson.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()

	var out map[string]any
	if err := dec.Decode(&out); err != nil {
		return fmt.Errorf("unmarshaling permission expression: %w", err)
	}

	*p = out

	return nil
}

// SelectPermissionConfig captures the columns, row filter, and aggregation
// access a select permission grants.
type SelectPermissionConfig struct {
	Columns []string `json:"columns,omitempty" yaml:"columns,omitempty"`
	// omitzero (not omitempty) so a present-but-empty `filter: {}` — Hasura's
	// "allow all rows" form, and a required field — survives export, while a
	// truly absent (nil) filter is still omitted.
	Filter            PermissionExpression `json:"filter,omitzero"             yaml:"filter,omitempty"`
	AllowAggregations bool                 `json:"allow_aggregations,omitzero" yaml:"allow_aggregations,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UnmarshalYAML accepts Hasura's select-permission `columns: '*'` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *SelectPermissionConfig) UnmarshalYAML(unmarshal func(any) error) error {
	type rawConfig struct {
		Columns           any            `yaml:"columns,omitempty"`
		Filter            map[string]any `yaml:"filter,omitempty"`
		AllowAggregations bool           `yaml:"allow_aggregations,omitempty"`
	}

	var raw rawConfig
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling select permission: %w", err)
	}

	columns, err := parsePermissionColumnsYAML(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling select permission columns: %w", err)
	}

	p.Columns = columns
	p.Filter = raw.Filter
	p.AllowAggregations = raw.AllowAggregations

	return nil
}

func parsePermissionColumnsYAML(value any) ([]string, error) {
	switch v := value.(type) {
	case nil:
		return nil, nil
	case string:
		if v != permissionAllColumns {
			return nil, errPermissionColumnsStringNotWildcard
		}

		return []string{permissionAllColumns}, nil
	case []string:
		return append([]string(nil), v...), nil
	case []any:
		columns := make([]string, 0, len(v))
		for i, item := range v {
			column, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf(
					"%w (index %d, type %T)",
					errPermissionColumnsListEntryNotString, i, item,
				)
			}

			columns = append(columns, column)
		}

		return columns, nil
	default:
		return nil, fmt.Errorf("%w (type %T)", errUnexpectedPermissionColumnsToken, value)
	}
}

// UnmarshalJSON accepts Hasura's select-permission `columns: "*"` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *SelectPermissionConfig) UnmarshalJSON(data []byte) error {
	var raw struct {
		Columns           jsontext.Value       `json:"columns,omitempty"`
		Filter            PermissionExpression `json:"filter,omitempty"`
		AllowAggregations bool                 `json:"allow_aggregations,omitzero"`
		// Capture unmodeled Hasura permission keys (limit, query_root_fields,
		// backend_only, …). The custom UnmarshalJSON bypasses the struct's own
		// `,unknown` field, so the sink must live on this raw struct.
		Unknown jsontext.Value `json:",unknown"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling select permission: %w", err)
	}

	columns, err := parsePermissionColumnsJSON(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling select permission columns: %w", err)
	}

	p.Columns = columns
	p.Filter = raw.Filter
	p.AllowAggregations = raw.AllowAggregations
	p.Unknown = raw.Unknown

	return nil
}

func parsePermissionColumnsJSON(value jsontext.Value) ([]string, error) {
	if value == nil {
		return nil, nil
	}

	switch firstNonWhitespaceByte(value) {
	case 'n':
		var columns []string
		if err := json.Unmarshal(value, &columns); err != nil {
			return nil, fmt.Errorf("decoding columns null: %w", err)
		}

		return columns, nil
	case '"':
		var shorthand string
		if err := json.Unmarshal(value, &shorthand); err != nil {
			return nil, fmt.Errorf("decoding columns shorthand: %w", err)
		}

		if shorthand != permissionAllColumns {
			return nil, errPermissionColumnsStringNotWildcard
		}

		return []string{permissionAllColumns}, nil
	case '[':
		var columns []string
		if err := json.Unmarshal(value, &columns); err != nil {
			return nil, fmt.Errorf("decoding columns list: %w", err)
		}

		return columns, nil
	default:
		return nil, fmt.Errorf(
			"%w (token %q)", errUnexpectedPermissionColumnsToken,
			firstNonWhitespaceByte(value),
		)
	}
}

// InsertPermissionConfig captures the columns, row-level check, and presets an
// insert permission grants.
type InsertPermissionConfig struct {
	Columns []string `json:"columns,omitempty" yaml:"columns,omitempty"`
	// omitzero so a present-but-empty `check: {}` (required by Hasura) survives
	// export; a nil check/set is still omitted.
	Check PermissionExpression `json:"check,omitzero" yaml:"check,omitempty"`
	Set   PermissionExpression `json:"set,omitzero"   yaml:"set,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UnmarshalYAML accepts Hasura's insert-permission `columns: '*'` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *InsertPermissionConfig) UnmarshalYAML(unmarshal func(any) error) error {
	type rawConfig struct {
		Columns any            `yaml:"columns,omitempty"`
		Check   map[string]any `yaml:"check,omitempty"`
		Set     map[string]any `yaml:"set,omitempty"`
	}

	var raw rawConfig
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling insert permission: %w", err)
	}

	columns, err := parsePermissionColumnsYAML(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling insert permission columns: %w", err)
	}

	p.Columns = columns
	p.Check = raw.Check
	p.Set = raw.Set

	return nil
}

// UnmarshalJSON accepts Hasura's insert-permission `columns: "*"` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *InsertPermissionConfig) UnmarshalJSON(data []byte) error {
	var raw struct {
		Columns jsontext.Value       `json:"columns,omitempty"`
		Check   PermissionExpression `json:"check,omitempty"`
		Set     PermissionExpression `json:"set,omitempty"`
		// Capture unmodeled Hasura permission keys; see SelectPermissionConfig.
		Unknown jsontext.Value `json:",unknown"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling insert permission: %w", err)
	}

	columns, err := parsePermissionColumnsJSON(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling insert permission columns: %w", err)
	}

	p.Columns = columns
	p.Check = raw.Check
	p.Set = raw.Set
	p.Unknown = raw.Unknown

	return nil
}

// UpdatePermissionConfig captures the columns, row filter, post-update check,
// and presets an update permission grants.
type UpdatePermissionConfig struct {
	Columns []string `json:"columns,omitempty" yaml:"columns,omitempty"`
	// omitzero so present-but-empty `filter: {}` / `check: {}` survive export;
	// nil values are still omitted.
	Filter PermissionExpression `json:"filter,omitzero" yaml:"filter,omitempty"`
	Check  PermissionExpression `json:"check,omitzero"  yaml:"check,omitempty"`
	Set    PermissionExpression `json:"set,omitzero"    yaml:"set,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// UnmarshalYAML accepts Hasura's update-permission `columns: '*'` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *UpdatePermissionConfig) UnmarshalYAML(unmarshal func(any) error) error {
	type rawConfig struct {
		Columns any            `yaml:"columns,omitempty"`
		Filter  map[string]any `yaml:"filter,omitempty"`
		Check   map[string]any `yaml:"check,omitempty"`
		Set     map[string]any `yaml:"set,omitempty"`
	}

	var raw rawConfig
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling update permission: %w", err)
	}

	columns, err := parsePermissionColumnsYAML(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling update permission columns: %w", err)
	}

	p.Columns = columns
	p.Filter = raw.Filter
	p.Check = raw.Check
	p.Set = raw.Set

	return nil
}

// UnmarshalJSON accepts Hasura's update-permission `columns: "*"` shorthand
// in addition to the explicit list of column names. The shorthand is kept as
// a one-element slice and expanded after database introspection, when the full
// column list is known.
func (p *UpdatePermissionConfig) UnmarshalJSON(data []byte) error {
	var raw struct {
		Columns jsontext.Value       `json:"columns,omitempty"`
		Filter  PermissionExpression `json:"filter,omitempty"`
		Check   PermissionExpression `json:"check,omitempty"`
		Set     PermissionExpression `json:"set,omitempty"`
		// Capture unmodeled Hasura permission keys; see SelectPermissionConfig.
		Unknown jsontext.Value `json:",unknown"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling update permission: %w", err)
	}

	columns, err := parsePermissionColumnsJSON(raw.Columns)
	if err != nil {
		return fmt.Errorf("unmarshaling update permission columns: %w", err)
	}

	p.Columns = columns
	p.Filter = raw.Filter
	p.Check = raw.Check
	p.Set = raw.Set
	p.Unknown = raw.Unknown

	return nil
}

// DeletePermissionConfig captures the row filter a delete permission applies.
type DeletePermissionConfig struct {
	// omitzero so a present-but-empty `filter: {}` (required by Hasura on delete
	// permissions) survives export; a nil filter is still omitted.
	Filter PermissionExpression `json:"filter,omitzero" yaml:"filter,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ObjectRelationship is a many-to-one relationship from this table to another.
type ObjectRelationship struct {
	Name  string            `json:"name"  yaml:"name"`
	Using RelationshipUsing `json:"using" yaml:"using"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ArrayRelationship is a one-to-many relationship from this table to another.
type ArrayRelationship struct {
	Name  string            `json:"name"  yaml:"name"`
	Using RelationshipUsing `json:"using" yaml:"using"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RelationshipUsing describes how a relationship is defined. Hasura's
// foreign_key_constraint_on accepts four shapes:
//
//  1. string                — single-column FK on the parent table.
//  2. array of strings      — composite FK on the parent table.
//  3. object with table+column  — single-column FK on the target table.
//  4. object with table+columns — composite FK on the target table.
//
// ForeignKeyColumns covers (1) and (2); ForeignKeyConstraint covers (3) and (4).
// Both are populated via custom unmarshaling rather than from JSON keys, so they
// are tagged json:"-".
type RelationshipUsing struct {
	ForeignKeyColumns    []string              `json:"-"`
	ForeignKeyConstraint *ForeignKeyConstraint `json:"-"`
	ManualConfiguration  *ManualConfiguration  `json:"manual_configuration,omitempty" yaml:"manual_configuration,omitempty"` //nolint:lll

	// Unknown preserves any sibling key Hasura may add to the `using` block
	// beyond the two modeled forms. Hasura's `using` is a closed union today, so
	// this is belt-and-braces — but the custom Un/MarshalJSON below bypass the
	// usual `,unknown` field handling, so capture and re-emit it by hand to keep
	// the round-trip invariant every other wire struct upholds. Tagged json:"-"
	// because the custom methods govern (the tag itself is inert here).
	Unknown jsontext.Value `json:"-" yaml:"-"`
}

func mapToForeignKeyConstraint(m map[string]any) (*ForeignKeyConstraint, error) {
	var (
		columns []string
		ts      TableSource
	)

	// Hasura accepts either "columns" (composite) or "column" (single). Prefer
	// the plural form when both are present.
	if v, ok := m["columns"].([]any); ok {
		columns = make([]string, 0, len(v))
		for i, item := range v {
			s, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf(
					"%w (index %d, type %T)",
					errForeignKeyListEntryNotString, i, item,
				)
			}

			columns = append(columns, s)
		}
	} else if v, ok := m["column"].(string); ok {
		columns = []string{v}
	}

	if table, ok := m["table"].(map[string]any); ok {
		if name, ok := table["name"].(string); ok {
			ts.Name = name
		}

		if schema, ok := table["schema"].(string); ok {
			ts.Schema = schema
		}
	}

	return &ForeignKeyConstraint{Columns: columns, Table: ts, Unknown: nil}, nil
}

// UnmarshalYAML accepts foreign_key_constraint_on as any of:
// a bare column name (string), a list of column names ([]string), or a full
// constraint object (mapping) carrying either "column" or "columns". A list
// containing a non-string entry is rejected so the YAML path matches the JSON
// path (which fails the same input via its strict []string decode).
func (r *RelationshipUsing) UnmarshalYAML(unmarshal func(any) error) error {
	type rawUsing struct {
		ForeignKeyConstraintOn any                  `yaml:"foreign_key_constraint_on,omitempty"`
		ManualConfiguration    *ManualConfiguration `yaml:"manual_configuration,omitempty"`
	}

	var raw rawUsing
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling relationship using: %w", err)
	}

	r.ManualConfiguration = raw.ManualConfiguration

	if raw.ForeignKeyConstraintOn == nil {
		return nil
	}

	switch v := raw.ForeignKeyConstraintOn.(type) {
	case string:
		r.ForeignKeyColumns = []string{v}
	case []any:
		cols := make([]string, 0, len(v))
		for i, item := range v {
			s, ok := item.(string)
			if !ok {
				return fmt.Errorf(
					"unmarshaling relationship using: %w (index %d, type %T)",
					errForeignKeyListEntryNotString, i, item,
				)
			}

			cols = append(cols, s)
		}

		r.ForeignKeyColumns = cols
	case map[string]any:
		constraint, err := mapToForeignKeyConstraint(v)
		if err != nil {
			return fmt.Errorf("unmarshaling relationship using: %w", err)
		}

		r.ForeignKeyConstraint = constraint
	default:
		return fmt.Errorf(
			"unmarshaling relationship using: %w (type %T)",
			errUnexpectedForeignKeyToken, v,
		)
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle the string,
// array-of-strings, and object forms of foreign_key_constraint_on. The shape
// is selected by peeking the first non-whitespace byte of the raw value so the
// decoder never has to swallow a parse error to fall through to the next case.
// An omitted field decodes to a nil raw value and is treated as a no-op; an
// explicit null is rejected via the default arm so malformed input fails
// loudly instead of silently producing a zero RelationshipUsing.
func (r *RelationshipUsing) UnmarshalJSON(data []byte) error {
	var raw struct {
		ForeignKeyConstraintOn jsontext.Value       `json:"foreign_key_constraint_on,omitempty"`
		ManualConfiguration    *ManualConfiguration `json:"manual_configuration,omitempty"`
		Unknown                jsontext.Value       `json:",unknown"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling relationship using: %w", err)
	}

	r.ManualConfiguration = raw.ManualConfiguration
	r.Unknown = raw.Unknown

	if raw.ForeignKeyConstraintOn == nil {
		return nil
	}

	first := firstNonWhitespaceByte(raw.ForeignKeyConstraintOn)

	switch first {
	case '"':
		var column string
		if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &column); err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyColumns = []string{column}
	case '[':
		var columns []string
		if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &columns); err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyColumns = columns
	case '{':
		constraint, err := unmarshalForeignKeyConstraintJSON(raw.ForeignKeyConstraintOn)
		if err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyConstraint = constraint
	default:
		return fmt.Errorf(
			"unmarshaling foreign key constraint: %w (token %q)",
			errUnexpectedForeignKeyToken, first,
		)
	}

	return nil
}

// firstNonWhitespaceByte returns the first non-whitespace byte of a JSON
// fragment, or 0 if the fragment is entirely whitespace.
func firstNonWhitespaceByte(b []byte) byte {
	for _, c := range b {
		switch c {
		case ' ', '\t', '\n', '\r':
			continue
		default:
			return c
		}
	}

	return 0
}

// unmarshalForeignKeyConstraintJSON parses the object form of
// foreign_key_constraint_on, accepting either "columns" (preferred, composite)
// or "column" (single-column) under the same object.
func unmarshalForeignKeyConstraintJSON(data []byte) (*ForeignKeyConstraint, error) {
	var raw struct {
		Columns []string    `json:"columns"`
		Column  string      `json:"column"`
		Table   TableSource `json:"table"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("decoding foreign key constraint object: %w", err)
	}

	columns := raw.Columns
	if len(columns) == 0 && raw.Column != "" {
		columns = []string{raw.Column}
	}

	return &ForeignKeyConstraint{Columns: columns, Table: raw.Table, Unknown: nil}, nil
}

// MarshalJSON inverts UnmarshalJSON. Emits the polymorphic
// `foreign_key_constraint_on` shape that matches how the value was originally
// populated: a bare string for a single column on the parent table, an array
// for a composite FK on the parent, or an object with `column(s)` and `table`
// for an FK on the target table. ManualConfiguration is emitted alongside
// when present, mirroring the input structure. Keys are emitted in
// deterministic (sorted) order so the export is byte-stable across processes.
func (r RelationshipUsing) MarshalJSON() ([]byte, error) {
	out := map[string]any{}

	// Merge any captured unknown sibling keys; they never collide with the
	// modeled keys below (the unknown sink excludes both modeled fields).
	if len(r.Unknown) > 0 {
		var extra map[string]jsontext.Value
		if err := json.Unmarshal(r.Unknown, &extra); err != nil {
			return nil, fmt.Errorf("marshaling relationship using unknown fields: %w", err)
		}

		for k, v := range extra {
			out[k] = v
		}
	}

	switch {
	case r.ForeignKeyConstraint != nil:
		out["foreign_key_constraint_on"] = r.ForeignKeyConstraint
	case len(r.ForeignKeyColumns) == 1:
		out["foreign_key_constraint_on"] = r.ForeignKeyColumns[0]
	case len(r.ForeignKeyColumns) > 1:
		out["foreign_key_constraint_on"] = r.ForeignKeyColumns
	}

	if r.ManualConfiguration != nil {
		out["manual_configuration"] = r.ManualConfiguration
	}

	// Deterministic so the export is byte-stable across processes: json/v2
	// otherwise emits this map's keys in randomized order whenever an unknown
	// sibling key accompanies a modeled one.
	b, err := json.Marshal(out, json.Deterministic(true))
	if err != nil {
		return nil, fmt.Errorf("marshaling relationship using: %w", err)
	}

	return b, nil
}

// ManualConfiguration describes a relationship that isn't backed by a database
// foreign key — either a cross-source (to_source) join or a to_remote_schema
// fetch. ColumnMapping and Source are populated for to_source; LHSFields and
// RemoteField are populated for to_remote_schema (the native package flattens
// RemoteField into a path and renames SQL columns to GraphQL during conversion).
type ManualConfiguration struct {
	RemoteTable   TableSource       `json:"remote_table"            yaml:"remote_table"`
	ColumnMapping map[string]string `json:"column_mapping"          yaml:"column_mapping"`
	Source        string            `json:"source,omitempty"        yaml:"source,omitempty"`
	RemoteSchema  string            `json:"remote_schema,omitempty" yaml:"remote_schema,omitempty"`

	LHSFields   []string                   `json:"-" yaml:"-"`
	RemoteField map[string]RemoteFieldCall `json:"-" yaml:"-"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ForeignKeyConstraint identifies the columns and table that anchor a
// foreign-key-backed relationship. Columns is the ordered list of columns on
// Table that point back at the parent table; a single-column FK is represented
// as a one-element slice.
type ForeignKeyConstraint struct {
	Columns []string    `json:"columns" yaml:"columns"`
	Table   TableSource `json:"table"   yaml:"table"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteRelationship represents a cross-database relationship in Hasura format.
// These are converted to ObjectRelationship or ArrayRelationship with ManualConfiguration
// during metadata processing.
type RemoteRelationship struct {
	Name       string                `json:"name"       yaml:"name"`
	Definition RemoteRelationshipDef `json:"definition" yaml:"definition"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteRelationshipDef defines the remote relationship configuration.
type RemoteRelationshipDef struct {
	ToSource       *ToSourceRelationship       `json:"to_source,omitempty"        yaml:"to_source,omitempty"`
	ToRemoteSchema *ToRemoteSchemaRelationship `json:"to_remote_schema,omitempty" yaml:"to_remote_schema,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ToRemoteSchemaRelationship defines a relationship to a remote GraphQL schema.
type ToRemoteSchemaRelationship struct {
	RemoteSchema string                     `json:"remote_schema" yaml:"remote_schema"`
	LHSFields    []string                   `json:"lhs_fields"    yaml:"lhs_fields"`
	RemoteField  map[string]RemoteFieldCall `json:"remote_field"  yaml:"remote_field"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteFieldCall defines a remote field path with arguments.
type RemoteFieldCall struct {
	Arguments map[string]string          `json:"arguments,omitempty" yaml:"arguments,omitempty"`
	Field     map[string]RemoteFieldCall `json:"field,omitempty"     yaml:"field,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// Relationship-type discriminator values for a to_source relationship's
// relationship_type field. The native metadata package names these too
// (metadata.RelationshipTypeObject/Array), but this package cannot import it
// without an import cycle, so they are duplicated here as local constants.
const (
	relationshipTypeObject = "object"
	relationshipTypeArray  = "array"
)

// ToSourceRelationship defines a relationship to another database source.
type ToSourceRelationship struct {
	FieldMapping     map[string]string `json:"field_mapping"     yaml:"field_mapping"`
	RelationshipType string            `json:"relationship_type" yaml:"relationship_type"`
	Source           string            `json:"source"            yaml:"source"`
	Table            TableSource       `json:"table"             yaml:"table"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// convertRemoteRelationships lowers Hasura-style remote_relationships into
// ObjectRelationship or ArrayRelationship with ManualConfiguration. For
// to_remote_schema relationships, the raw RemoteField map and lhs_fields are
// preserved verbatim; the native metadata package handles the flattening and
// the SQL→GraphQL column rename during conversion.
//
// The conversion is idempotent: a remote relationship whose name already
// appears in ObjectRelationships or ArrayRelationships is skipped, so
// re-parsing an input that already carries both forms does not double-append.
// Round-trip stability is provided separately by withoutDerivedRelationships
// in ToJSON, which strips the lowered duplicates before marshaling (so the
// guard never fires on the round-trip path — only on an input blob that
// genuinely carries an object/array and a remote relationship of one name).
func (t *TableMetadata) convertRemoteRelationships() {
	existing := make(map[string]struct{}, len(t.ObjectRelationships)+len(t.ArrayRelationships))
	for _, r := range t.ObjectRelationships {
		existing[r.Name] = struct{}{}
	}

	for _, r := range t.ArrayRelationships {
		existing[r.Name] = struct{}{}
	}

	for _, remote := range t.RemoteRelationships {
		if _, dup := existing[remote.Name]; dup {
			continue
		}

		if remote.Definition.ToSource != nil {
			t.appendToSourceRelationship(remote)
			continue
		}

		if remote.Definition.ToRemoteSchema != nil {
			t.appendToRemoteSchemaRelationship(remote)
		}
	}
}

func (t *TableMetadata) appendToSourceRelationship(remote RemoteRelationship) {
	toSource := remote.Definition.ToSource
	using := RelationshipUsing{
		ForeignKeyColumns:    nil,
		ForeignKeyConstraint: nil,
		ManualConfiguration: &ManualConfiguration{
			RemoteTable: TableSource{
				Name:    toSource.Table.Name,
				Schema:  toSource.Table.Schema,
				Unknown: nil,
			},
			ColumnMapping: toSource.FieldMapping,
			Source:        toSource.Source,
			RemoteSchema:  "",
			LHSFields:     nil,
			RemoteField:   nil,
			Unknown:       nil,
		},
		Unknown: nil,
	}

	switch toSource.RelationshipType {
	case relationshipTypeObject:
		t.ObjectRelationships = append(t.ObjectRelationships, ObjectRelationship{
			Name:    remote.Name,
			Using:   using,
			Unknown: nil,
		})
	case relationshipTypeArray:
		t.ArrayRelationships = append(t.ArrayRelationships, ArrayRelationship{
			Name:    remote.Name,
			Using:   using,
			Unknown: nil,
		})
	default:
		// Keep invalid entries in RemoteRelationships only. The native conversion
		// preserves that raw entry so SQL-source reconciliation can record a
		// relationship inconsistency once a collector is available.
		return
	}
}

func (t *TableMetadata) appendToRemoteSchemaRelationship(remote RemoteRelationship) {
	toRemoteSchema := remote.Definition.ToRemoteSchema

	// Remote schema relationships are always object relationships (the remote
	// field determines if it returns an array).
	t.ObjectRelationships = append(t.ObjectRelationships, ObjectRelationship{
		Name: remote.Name,
		Using: RelationshipUsing{
			ForeignKeyColumns:    nil,
			ForeignKeyConstraint: nil,
			ManualConfiguration: &ManualConfiguration{
				RemoteTable:   TableSource{Name: "", Schema: "", Unknown: nil},
				ColumnMapping: nil,
				Source:        "",
				RemoteSchema:  toRemoteSchema.RemoteSchema,
				LHSFields:     toRemoteSchema.LHSFields,
				RemoteField:   toRemoteSchema.RemoteField,
				Unknown:       nil,
			},
			Unknown: nil,
		},
		Unknown: nil,
	})
}
