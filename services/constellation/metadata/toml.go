package metadata

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

var errInvalidComputedTOML = errors.New("invalid computed metadata for TOML export")

// MarshalTOML encodes metadata to TOML using a map-based representation.
// Invalid wire-only computed entries cannot be expressed in TOML without
// losing their decode errors; reject export instead of silently widening grants.
func MarshalTOML(m *Metadata) ([]byte, error) {
	if err := validateComputedTOML(m); err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}

	enc := toml.NewEncoder(buf).
		SetIndentTables(true).
		SetArraysMultiline(true).
		SetIndentSymbol("    ")

	if err := enc.Encode(m); err != nil {
		return nil, fmt.Errorf("encoding metadata to TOML: %w", err)
	}

	return stripEmptyTableHeaders(buf.Bytes()), nil
}

func validateComputedTOML(m *Metadata) error {
	for _, db := range m.Databases {
		for _, table := range db.Tables {
			for i, field := range table.ComputedFields {
				if field.DecodeError != "" || field.Name == "" ||
					field.Definition.Function.Name == "" {
					return fmt.Errorf(
						"%w: invalid computed field in source %q table %q at index %d: %s",
						errInvalidComputedTOML,
						db.Name,
						table.Table.Name,
						i,
						field.DecodeError,
					)
				}
			}

			for _, permission := range table.SelectPermissions {
				if len(permission.Permission.InvalidComputedFields) != 0 {
					return fmt.Errorf(
						"%w: invalid computed grants in source %q table %q role %q",
						errInvalidComputedTOML,
						db.Name,
						table.Table.Name,
						permission.Role,
					)
				}

				for i, grant := range permission.Permission.ComputedFields {
					if grant == "" {
						return fmt.Errorf(
							"%w: empty computed grant in source %q table %q role %q at index %d",
							errInvalidComputedTOML,
							db.Name,
							table.Table.Name,
							permission.Role,
							i,
						)
					}
				}
			}
		}
	}

	return nil
}

// unmarshalTOML decodes TOML data from the map-based representation into Metadata.
func unmarshalTOML(data []byte) (*Metadata, error) {
	var tm Metadata
	if err := toml.Unmarshal(data, &tm); err != nil {
		return nil, fmt.Errorf("parsing TOML metadata: %w", err)
	}

	normalizeMetadataPermissionNumbers(&tm)

	for i := range tm.Databases {
		for j := range tm.Databases[i].Tables {
			restoreRemoteSchemaPaths(&tm.Databases[i].Tables[j])
		}
	}

	return &tm, nil
}

// restoreRemoteSchemaPaths rebuilds Hasura-lowered paths omitted by the TOML
// wire format. The raw definition survives export alongside the lowered one.
// Leave raw-only native relationships to the controller's planner fallback.
func restoreRemoteSchemaPaths(table *TableMetadata) {
	rename := tableColumnRenamer(table.Configuration.ColumnConfig)
	for _, raw := range table.RemoteRelationships {
		toRS := raw.Definition.ToRemoteSchema
		if toRS == nil {
			continue
		}

		for i := range table.ObjectRelationships {
			if table.ObjectRelationships[i].Name == raw.Name {
				restoreRemoteSchemaPath(
					table.ObjectRelationships[i].Using.ManualConfiguration,
					toRS,
					rename,
				)
			}
		}

		for i := range table.ArrayRelationships {
			if table.ArrayRelationships[i].Name == raw.Name {
				restoreRemoteSchemaPath(
					table.ArrayRelationships[i].Using.ManualConfiguration,
					toRS,
					rename,
				)
			}
		}
	}
}

func restoreRemoteSchemaPath(
	mc *ManualConfiguration,
	raw *ToRemoteSchemaRelationship,
	rename columnRenamer,
) {
	if mc == nil || mc.RemoteSchema == "" || mc.RemoteSchema != raw.RemoteSchema ||
		len(mc.RemoteFieldPath) != 0 {
		return
	}

	path := ExtractRemoteFieldPath(raw.RemoteField)
	if len(path) == 0 {
		return
	}

	// ColumnMapping was already renamed by the Hasura converter before export.
	// Rebuild it from the raw SQL LHS names rather than renaming its keys twice.
	if len(raw.LHSFields) > 0 {
		mc.ColumnMapping = make(map[string]string, len(raw.LHSFields))
		for _, lhs := range raw.LHSFields {
			name := rename(lhs)
			mc.ColumnMapping[name] = name
		}
	}

	mc.RemoteFieldPath = path
	for i := range mc.RemoteFieldPath {
		args := make(map[string]string, len(path[i].Arguments))
		for arg, value := range path[i].Arguments {
			if sqlName, ok := strings.CutPrefix(value, "$"); ok {
				value = "$" + rename(sqlName)
			}

			args[arg] = value
		}

		mc.RemoteFieldPath[i].Arguments = args
	}
}

func normalizeMetadataPermissionNumbers(m *Metadata) {
	if m == nil {
		return
	}

	for i := range m.Databases {
		for j := range m.Databases[i].Tables {
			normalizeTablePermissionNumbers(&m.Databases[i].Tables[j])
		}
	}
}

func normalizeTablePermissionNumbers(t *TableMetadata) {
	for i := range t.SelectPermissions {
		t.SelectPermissions[i].Permission.Filter = normalizePermissionMap(
			t.SelectPermissions[i].Permission.Filter,
		)
	}

	for i := range t.InsertPermissions {
		t.InsertPermissions[i].Permission.Check = normalizePermissionMap(
			t.InsertPermissions[i].Permission.Check,
		)
		t.InsertPermissions[i].Permission.Set = normalizePermissionMap(
			t.InsertPermissions[i].Permission.Set,
		)
	}

	for i := range t.UpdatePermissions {
		t.UpdatePermissions[i].Permission.Filter = normalizePermissionMap(
			t.UpdatePermissions[i].Permission.Filter,
		)
		t.UpdatePermissions[i].Permission.Check = normalizePermissionMap(
			t.UpdatePermissions[i].Permission.Check,
		)
		t.UpdatePermissions[i].Permission.Set = normalizePermissionMap(
			t.UpdatePermissions[i].Permission.Set,
		)
	}

	for i := range t.DeletePermissions {
		t.DeletePermissions[i].Permission.Filter = normalizePermissionMap(
			t.DeletePermissions[i].Permission.Filter,
		)
	}
}

// stripEmptyTableHeaders removes TOML table headers (e.g. [a.b]) that contain
// no key-value pairs of their own — only sub-tables. These are redundant because
// TOML infers intermediate tables automatically.
func stripEmptyTableHeaders(data []byte) []byte {
	lines := bytes.Split(data, []byte("\n"))
	keep := make([]bool, len(lines))

	for i, line := range lines {
		trimmed := bytes.TrimSpace(line)

		// Not a [table] header → always keep.
		if len(trimmed) == 0 || trimmed[0] != '[' || trimmed[0] == '#' {
			keep[i] = true
			continue
		}

		// [[array]] headers → always keep.
		if bytes.HasPrefix(trimmed, []byte("[[")) {
			keep[i] = true
			continue
		}

		// It's a [table] header. Check whether the next non-blank line is
		// another header (or EOF). If so this header is empty.
		hasContent := false
		for j := i + 1; j < len(lines); j++ {
			next := bytes.TrimSpace(lines[j])
			if len(next) == 0 {
				continue
			}

			if next[0] == '[' {
				break
			}

			hasContent = true

			break
		}

		keep[i] = hasContent
	}

	out := make([][]byte, 0, len(lines))
	for i, line := range lines {
		if keep[i] {
			out = append(out, line)
		}
	}

	return bytes.Join(out, []byte("\n"))
}
