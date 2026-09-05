package hasura

import "encoding/json/jsontext"

// InheritedRole is a top-level inherited role: an effective role whose
// permissions are the merge of its parent roles. The wire shape matches
// Hasura's add_inherited_role payload and metadata export, where the parent
// roles are carried under the "role_set" key (verified against graphql-engine
// Hasura.Authentication.Role).
type InheritedRole struct {
	RoleName string         `json:"role_name" yaml:"role_name"`
	RoleSet  []string       `json:"role_set"  yaml:"role_set"`
	Unknown  jsontext.Value `json:",unknown"  yaml:"-"`
}
