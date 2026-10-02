package metadata

import (
	"bytes"
	"errors"
	"fmt"

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

	return &tm, nil
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
