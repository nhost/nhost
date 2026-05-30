package queries_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
)

func TestBuildSelectionSQL(t *testing.T) { //nolint:maintidx,paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: simple select",
			query: query{
				Query: `
					query {
						departments {
							id
							name
						}
					}`,
				Role:      "user",
				Variables: nil,
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "user: simple select with no permissions for column",
			query: query{
				Query: `
					query {
						departments {
							id
							name
						}
					}`,
				Role:      "user",
				Variables: nil,
			},
			expectError: permissions.ErrSessionVariableNotFound,
		},

		{
			name: "relationships",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							employees {
								user_id
								user {
								  defaultRoleByRole {
							   	    role
								  }
								}
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: simple select with only permitted columns",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							budget
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{123e4567-e89b-12d3-a456-426614174000}",
				},
				Variables: nil,
			},
		},

		{
			name: "named fragment",
			query: query{
				Query: `
					query {
						departments {
							...DeptFields
						}
					}
					fragment DeptFields on departments {
						id
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "multiple fragments",
			query: query{
				Query: `
					query {
						departments {
							...DeptID
							...DeptName
						}
					}
					fragment DeptID on departments {
						id
					}
					fragment DeptName on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "inline fragment",
			query: query{
				Query: `
					query {
						departments {
							... {
								id
								name
							}
						}
					}`,
				Variables: nil,
			},
		},

		{
			name: "mixed fields and fragments",
			query: query{
				Query: `
					query {
						departments {
							id
							...DeptName
						}
					}
					fragment DeptName on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "fragment with alias",
			query: query{
				Query: `
					query {
						departments {
							...DeptFields
							department_id: id
						}
					}
					fragment DeptFields on departments {
						name
					}`,
				Variables: nil,
			},
		},

		{
			name: "simple where clause with _eq",
			query: query{
				Query: `
					query {
						departments(where: {name: {_eq: "Sales"}}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with _in",
			query: query{
				Query: `
					query {
						departments(where: {name: {_in: ["Sales", "Marketing", "Engineering"]}}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with _and",
			query: query{
				Query: `
					query {
						departments(where: {_and: [{name: {_eq: "Sales"}}, {budget: {_eq: 100000}}]}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "where clause with variables",
			query: query{
				Query: `
					query($dept_name: String!) {
						departments(where: {name: {_eq: $dept_name}}) {
							id
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"dept_name": "Sales",
				},
			},
		},

		{
			name: "relationship with where clause",
			query: query{
				Query: `
					query {
						departments {
							id
							name
							employees(where: {user_id: {_eq: "123e4567-e89b-12d3-a456-426614174000"}}) {
								user_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "user: select with where clause and row-level permissions",
			query: query{
				Query: `
					query {
						departments(where: {name: {_eq: "Engineering"}}) {
							id
							name
							budget
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{123e4567-e89b-12d3-a456-426614174001,123e4567-e89b-12d3-a456-426614174002}",
				},
				Variables: nil,
			},
		},

		{
			name: "nested relationship filter with multiple levels",
			query: query{
				Query: `
					query {
						departments {
							name
							employees(where: {user: {displayName: {_eq: "Robert Taylor"}}}) {
								user_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "order by single column ascending",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "order by multiple columns",
			query: query{
				Query: `
					query {
						departments(order_by: [{name: desc}, {created_at: asc}]) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "limit and offset",
			query: query{
				Query: `
					query {
						departments(limit: 10, offset: 5) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			// Hasura rejects a negative limit during query parsing; Constellation
			// must do the same rather than forwarding "LIMIT -1" to Postgres
			// (which raises an execution-time error).
			name: "negative limit rejected",
			query: query{
				Query: `
					query {
						departments(limit: -1) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
			expectError: arguments.ErrInvalidArgument,
		},

		{
			// Same pre-execution rejection for a negative offset.
			name: "negative offset rejected",
			query: query{
				Query: `
					query {
						departments(offset: -1) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
			expectError: arguments.ErrInvalidArgument,
		},

		{
			name: "distinct on with order by",
			query: query{
				Query: `
					query {
						user_departments(distinct_on: department_id, order_by: {department_id: asc}) {
							department_id
							user_id
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			// distinct_on column differs from the leading order_by column. Hasura
			// rejects this at validation ("distinct_on" columns must match initial
			// "order_by" columns) rather than reconciling, so Constellation does
			// too — it does not silently reorder the user's order_by.
			name: "distinct on with mismatched order by",
			query: query{
				Query: `
					query {
						departments(distinct_on: name, order_by: {budget: desc}) {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
			expectError: arguments.ErrDistinctOnOrderByMismatch,
		},

		{
			// distinct_on with no order_by must still emit a leading ORDER BY on
			// the distinct columns so row selection is deterministic, matching
			// Hasura.
			name: "distinct on without order by",
			query: query{
				Query: `
					query {
						departments(distinct_on: name) {
							id
							name
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "combined where, order by, limit",
			query: query{
				Query: `
					query {
						departments(where: {budget: {_gt: 100000}}, order_by: {budget: desc}, limit: 5) {
							id
							name
							budget
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "list variable providing object instead of list",
			query: query{
				Query: `query($limit: Int!, $offset: Int!, $orderBy: [users_order_by!]) {
					users(limit: $limit, offset: $offset, order_by: $orderBy) {
						id
						displayName
					}
				}`,
				Role: "admin",
				Variables: map[string]any{
					"limit":   3,
					"offset":  1,
					"orderBy": map[string]any{"displayName": "asc"},
				},
			},
		},

		{
			name: "nested relationship with distinct_on, order_by, where, and limit",
			query: query{
				Query: `
					query {
						departments(limit: 2) {
							id
							name
							employees(
								distinct_on: user_id,
								where: {department_id: {_is_null: false}},
								order_by: {user_id: asc},
								limit: 3
							) {
								user_id
								department_id
							}
						}
					}`,
				Role:      "admin",
				Variables: nil,
			},
		},

		{
			name: "nested, filtering",
			query: query{
				Query: `
					{
					  departments {
						name
						files(where: {file:{bucketId: {_eq: "default"}}}) {
						  file {
							name
						  }
						  department {
							name
						  }
						}
					  }
					}`,
				Variables:        nil,
				Role:             "admin",
				SessionVariables: map[string]any{},
			},
		},

		{
			name: "permissions: nested, filtering",
			query: query{
				Query: `
					query {
					  departments {
					    files(where: {file: {bucketId: {_eq: "profile_pics"}}}) {
					  	  file {
					        name
					      }
					      department {
					        name
					      }
					    }
					  }
					}`,
				Variables: nil,
				Role:      "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440001",
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "nested query with limit - three levels",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							department {
								id
								name
								files(limit: 5) {
									id
									description
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "complex: nested with relationship traversal in WHERE",
			query: query{
				Query: `query {
					files(
						where: {
							department_file: {
								department: {
									name: {_eq: "Engineering"}
								}
							}
						},
						limit: 5
					) {
						id
						name
						bucket {
							id
						}
						department_file {
							id
							department {
								id
								name
								files(limit: 3) {
									id
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with aliased employee sets",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						name
						activeEmployees: employees(where: {is_active: {_eq: true}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
						inactiveEmployees: employees(where: {is_active: {_eq: false}}, limit: 10) {
							role
							user {
								id
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "duplicate relationship fields (merging)",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						employees {
							user_id
						}
						employees {
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "duplicate relationship with fragments (merging)",
			query: query{
				Query: `
					fragment EmployeeIds on user_departments {
						user_id
					}

					fragment EmployeeRoles on user_departments {
						role
					}

					query {
						departments(limit: 3) {
							id
							employees {
								...EmployeeIds
							}
							employees {
								...EmployeeRoles
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "nested duplicate relationships",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						employees {
							user {
								id
							}
						}
						employees {
							user {
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// JSONB query operators
		{
			name: "jsonb _contains - find users with specific profile",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { profile: { title: "HR Manager" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains - find users with specific tag",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { tags: ["manager"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contained_in - find users with metadata contained in given value",
			query: query{
				Query: `query {
					users(where: { metadata: { _contained_in: { profile: { title: "HR Manager", level: 5 }, tags: ["manager", "hr", "leadership"], skills: ["recruitment", "compliance", "training"] } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with profile key",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_key: "profile" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_key - find users with tags key",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_key: "tags" } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_all - find users with both profile and tags",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_keys_all: ["profile", "tags"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any - find users with profile or skills",
			query: query{
				Query: `query {
					users(where: { metadata: { _has_keys_any: ["profile", "skills"] } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _has_keys_any with variables",
			query: query{
				Query: `query FindUsersByKeys($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_has_keys_any": []any{"languages", "certifications"},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "jsonb combined with other filters",
			query: query{
				Query: `query {
					users(where: {
						_and: [
							{ metadata: { _has_key: "profile" } },
							{ locale: { _eq: "en" } }
						]
					}) {
						id
						displayName
						locale
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with nested object",
			query: query{
				Query: `query {
					users(where: { metadata: { _contains: { preferences: { theme: "dark" } } } }) {
						id
						displayName
						metadata
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "jsonb _contains with variables",
			query: query{
				Query: `query FindUsersWithMetadata($where: users_bool_exp!) {
					users(where: $where) {
						id
						displayName
						metadata
					}
				}`,
				Variables: map[string]any{
					"where": map[string]any{
						"metadata": map[string]any{
							"_contains": map[string]any{
								"profile": map[string]any{
									"level": 5,
								},
							},
						},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "permissions: _exists operator",
			query: query{
				Query: `
					query {
					  news {
					    id
					    title
					    content
					  }
					}`,
				Variables: nil,
				Role:      "exists_test",
				SessionVariables: map[string]any{
					"x-hasura-user-id": "550e8400-e29b-41d4-a716-446655440001",
				},
			},
		},
		{
			name: "aggregate filter: count predicate",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {count: {predicate: {_gt: 7}}}
						}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "aggregate filter: count with arguments, distinct and filter",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {count: {
								arguments: [user_id]
								distinct: true
								predicate: {_gte: 8}
								filter: {is_active: {_eq: true}}
							}}
						}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "aggregate filter: bool_and",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {bool_and: {arguments: is_active, predicate: {_eq: true}}}
						}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "aggregate filter: bool_or",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {bool_or: {arguments: is_active, predicate: {_eq: false}}}
						}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			// The `predicate` field is typed as Int_comparison_exp!, so binding
			// the whole comparison object to a variable is valid GraphQL. It must
			// resolve to the same SQL/params as the inline `predicate: {_gt: 7}`
			// case above; if the variable is not resolved at the predicate
			// boundary it errors with "field comparison must be an object".
			name: "aggregate filter: count predicate via variable",
			query: query{
				Query: `
					query($p: Int_comparison_exp!) {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {count: {predicate: $p}}
						}) {
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"p": map[string]any{"_gt": 7},
				},
			},
		},
		{
			// Same variable-resolution path for the Boolean_comparison_exp!
			// predicate used by bool_and/bool_or.
			name: "aggregate filter: bool_and predicate via variable",
			query: query{
				Query: `
					query($p: Boolean_comparison_exp!) {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {bool_and: {arguments: is_active, predicate: $p}}
						}) {
							name
						}
					}`,
				Role: "admin",
				Variables: map[string]any{
					"p": map[string]any{"_eq": true},
				},
			},
		},
		{
			// The aggregate subquery MUST apply the target table's row-level
			// permissions so a restricted role cannot filter on (and thereby
			// infer the size of) related rows it is not allowed to see. The
			// generated SQL for this case includes the user_departments RLS
			// predicate inside the EXISTS subquery.
			name: "aggregate filter: applies target row-level permissions",
			query: query{
				Query: `
					query {
						departments(order_by: {name: asc}, where: {
							employees_aggregate: {count: {predicate: {_gt: 7}}}
						}) {
							name
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440011",
					"x-hasura-departments": "{023d4410-715e-4675-96a5-a58fd50ef33c,24e9b8db-acf8-439f-9d63-7f83de523fb3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
		{
			name: "order_by object relationship column",
			query: query{
				Query: `
					query {
						user_departments(order_by: {department: {name: asc}}, limit: 10) {
							user_id
							role
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "order_by object relationship multiple columns",
			query: query{
				Query: `
					query {
						user_departments(
							order_by: {department: {budget: desc_nulls_last, name: asc}}
							limit: 10
						) {
							user_id
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "order_by array relationship aggregate count",
			query: query{
				Query: `
					query {
						departments(order_by: {employees_aggregate: {count: desc}}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "order_by array relationship aggregate max column",
			query: query{
				Query: `
					query {
						departments(order_by: {employees_aggregate: {max: {joined_at: asc_nulls_first}}}) {
							name
						}
					}`,
				Role: "admin",
			},
		},
		{
			// Relationship ordering applies the target table's row-level
			// permissions inside the correlated subquery, matching Hasura. The
			// generated SQL for this case includes the departments RLS predicate.
			name: "order_by object relationship applies target permissions",
			query: query{
				Query: `
					query {
						user_departments(order_by: {department: {name: asc}}, limit: 10) {
							user_id
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-user-id":     "550e8400-e29b-41d4-a716-446655440011",
					"x-hasura-departments": "{023d4410-715e-4675-96a5-a58fd50ef33c,24e9b8db-acf8-439f-9d63-7f83de523fb3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
		{
			// Nested object-into-object ordering. kb_entry_departments ->
			// kb_entry (object) -> uploader (object) -> displayName (a
			// customized column name on auth.users). The inner column subquery
			// is wrapped in the enclosing relationship's subquery, producing two
			// distinct correlated subqueries with distinct _cs_ob aliases (outer
			// correlates to kb_entry_departments, inner to the kb_entries alias).
			name: "order_by nested object relationship column",
			query: query{
				Query: `
					query {
						kb_entry_departments(
							order_by: {kb_entry: {uploader: {displayName: asc}}}
							limit: 10
						) {
							id
						}
					}`,
				Role: "admin",
			},
		},
		{
			// Nested object-into-aggregate ordering. user_departments ->
			// department (object) -> employees_aggregate (array) -> count. The
			// inner correlated aggregate subquery is wrapped in the object
			// relationship's subquery, producing two distinct _cs_ob aliases
			// (outer correlates to user_departments, inner aggregates the
			// employees of the departments alias).
			name: "order_by nested object relationship aggregate count",
			query: query{
				Query: `
					query {
						user_departments(
							order_by: {department: {employees_aggregate: {count: asc}}}
							limit: 10
						) {
							user_id
						}
					}`,
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, false)
}
