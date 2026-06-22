package metadata

// InheritedRole is a top-level inherited role: an effective role whose
// permissions are the merge of its parent roles (RoleSet). The wire shape
// mirrors Hasura's add_inherited_role payload and metadata export.
//
// At build time inherited roles are expanded into concrete per-role
// permissions on database tables, functions, and actions (see
// ExpandInheritedRoles) so the rest of the pipeline treats an inherited role
// like any other role. Remote-schema permissions are not inherited.
type InheritedRole struct {
	RoleName string   `json:"role_name" toml:"role_name"`
	RoleSet  []string `json:"role_set"  toml:"role_set"`
}
