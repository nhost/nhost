package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestCollectRolesFromDatabaseMetadata(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		md       *metadata.DatabaseMetadata
		expected []string
	}{
		{
			name:     "nil metadata returns empty",
			md:       nil,
			expected: []string{},
		},
		{
			name:     "empty tables returns only admin",
			md:       &metadata.DatabaseMetadata{},
			expected: []string{"admin"},
		},
		{
			name: "collects roles from select permissions",
			md: &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{
					{
						SelectPermissions: []metadata.SelectPermission{
							{Role: "user"},
							{Role: "editor"},
						},
					},
				},
			},
			expected: []string{"user", "editor", "admin"},
		},
		{
			name: "collects roles from all permission types",
			md: &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{
					{
						SelectPermissions: []metadata.SelectPermission{
							{Role: "reader"},
						},
						InsertPermissions: []metadata.InsertPermission{
							{Role: "writer"},
						},
						UpdatePermissions: []metadata.UpdatePermission{
							{Role: "editor"},
						},
						DeletePermissions: []metadata.DeletePermission{
							{Role: "admin_user"},
						},
					},
				},
			},
			expected: []string{"reader", "writer", "editor", "admin_user", "admin"},
		},
		{
			name: "deduplicates roles across tables and permission types",
			md: &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{
					{
						SelectPermissions: []metadata.SelectPermission{
							{Role: "user"},
						},
						InsertPermissions: []metadata.InsertPermission{
							{Role: "user"},
						},
					},
					{
						SelectPermissions: []metadata.SelectPermission{
							{Role: "user"},
						},
						DeletePermissions: []metadata.DeletePermission{
							{Role: "manager"},
						},
					},
				},
			},
			expected: []string{"user", "manager", "admin"},
		},
		{
			name: "admin in permissions is not duplicated",
			md: &metadata.DatabaseMetadata{
				Tables: []metadata.TableMetadata{
					{
						SelectPermissions: []metadata.SelectPermission{
							{Role: "admin"},
						},
					},
				},
			},
			expected: []string{"admin"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := collectRolesFromDatabaseMetadata(tt.md)

			if len(got) != len(tt.expected) {
				t.Fatalf(
					"got %d roles %v, want %d roles %v",
					len(got),
					got,
					len(tt.expected),
					tt.expected,
				)
			}

			for i, role := range got {
				if role != tt.expected[i] {
					t.Errorf("role[%d] = %q, want %q", i, role, tt.expected[i])
				}
			}
		})
	}
}

// TestGetTypeName is white-box because the test needs to construct a
// *Connector with unexported fields (dbMeta) populated directly. Black-box
// callers cannot reach those fields, and GetTypeName only reads dbMeta, so
// a literal struct is the most faithful fixture.
func TestGetTypeName(t *testing.T) {
	t.Parallel()

	c := &Connector{
		dbMeta: &metadata.DatabaseMetadata{
			Tables: []metadata.TableMetadata{
				{
					Table: metadata.TableSource{
						Schema: "public",
						Name:   "users",
					},
					Configuration: metadata.TableConfiguration{
						CustomName: "User",
					},
				},
				{
					Table: metadata.TableSource{
						Schema: "public",
						Name:   "posts",
					},
				},
				{
					Table: metadata.TableSource{
						Schema: "other",
						Name:   "users",
					},
				},
			},
		},
	}

	tests := []struct {
		name       string
		identifier string
		expected   string
	}{
		{
			name:       "returns custom name when configured",
			identifier: "public.users",
			expected:   "User",
		},
		{
			name:       "returns table name when no custom name",
			identifier: "public.posts",
			expected:   "posts",
		},
		{
			name:       "matches schema and table correctly",
			identifier: "other.users",
			expected:   "users",
		},
		{
			name:       "returns empty for nonexistent table",
			identifier: "public.nonexistent",
			expected:   "",
		},
		{
			name:       "returns empty for invalid identifier without dot",
			identifier: "nodot",
			expected:   "",
		},
		{
			name:       "returns empty for empty identifier",
			identifier: "",
			expected:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := c.GetTypeName(tt.identifier)
			if got != tt.expected {
				t.Errorf("GetTypeName(%q) = %q, want %q", tt.identifier, got, tt.expected)
			}
		})
	}
}
