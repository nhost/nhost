package integration_test

import (
	"testing"
)

func TestNestedQueries(t *testing.T) { //nolint:maintidx,paralleltest
	ReinitializeTestData(t)

	cases := []TestCase{
		{
			name: "with forward and reverse object relationships",
			query: query{
				Query: `query {
				  files {
					bucket {
					  id
					}
					department_file {
					  department {
						name
					  }
					}
				  }
				}`,
				Variables: nil,
				Role:      "admin",
			},
		},

		{
			name: "long nested relationship alias does not collide after PostgreSQL truncation",
			query: query{
				Query: `query {
					departments(limit: 2, order_by: {id: asc}) {
						id
						thisRelationshipAliasIsLongEnoughToCollideAfterPgTrunc: employees(
							limit: 2,
							order_by: {user_id: asc}
						) {
							user {
								id
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Basic one-level nested queries - users with roles
		{
			name: "users with roles",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						roles {
							id
							role
							createdAt
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with roles filtered",
			query: query{
				Query: `query {
					users(
						where: {disabled: {_eq: false}},
						limit: 5
					) {
						id
						displayName
						roles(where: {role: {_eq: "user"}}) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with roles ordered",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						roles(order_by: {createdAt: desc}) {
							id
							role
							createdAt
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with roles limited",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						roles(limit: 2) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		// users with departments
		{
			name: "users with departments",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						departments {
							role
							is_active
							joined_at
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with active departments",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						departments(where: {is_active: {_eq: true}}) {
							role
							is_active
						}
					}
				}`,
				Role: "admin",
			},
		},

		// users with refreshTokens
		{
			name: "users with refreshTokens",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						refreshTokens {
							id
							createdAt
							expiresAt
							type
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with non-expired refreshTokens",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						refreshTokens(where: {expiresAt: {_gt: "2025-01-01T00:00:00Z"}}) {
							id
							expiresAt
						}
					}
				}`,
				Role: "admin",
			},
		},

		// users with securityKeys
		{
			name: "users with securityKeys",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						securityKeys {
							id
							credentialId
							counter
							nickname
						}
					}
				}`,
				Role: "admin",
			},
		},

		// users with userProviders
		{
			name: "users with userProviders",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						email
						userProviders {
							id
							providerId
							providerUserId
							createdAt
						}
					}
				}`,
				Role: "admin",
			},
		},

		// users with kbEntries
		{
			name: "users with kbEntries",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						kbEntries {
							id
							title
							summary
							created_at
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with kbEntries ordered",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						kbEntries(order_by: {created_at: desc}, limit: 5) {
							id
							title
							created_at
						}
					}
				}`,
				Role: "admin",
			},
		},

		// departments with employees
		{
			name: "departments with employees",
			query: query{
				Query: `query {
					departments(limit: 5) {
						id
						name
						description
						employees {
							role
							is_active
							joined_at
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with active employees",
			query: query{
				Query: `query {
					departments(limit: 5) {
						id
						name
						employees(where: {is_active: {_eq: true}}) {
							role
							is_active
						}
					}
				}`,
				Role: "admin",
			},
		},

		// departments with files
		{
			name: "departments with files",
			query: query{
				Query: `query {
					departments(limit: 5) {
						id
						name
						files {
							id
							description
						}
					}
				}`,
				Role: "admin",
			},
		},

		// departments with kb_entry_departments
		{
			name: "departments with kb_entry_departments",
			query: query{
				Query: `query {
					departments(limit: 5) {
						id
						name
						kb_entry_departments {
							id
							kb_entry_id
						}
					}
				}`,
				Role: "admin",
			},
		},

		// files with bucket
		{
			name: "files with bucket",
			query: query{
				Query: `query {
					files(limit: 5) {
						id
						name
						size
						bucket {
							id
							downloadExpiration
							maxUploadFileSize
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "files with bucket filtered",
			query: query{
				Query: `query {
					files(
						where: {isUploaded: {_eq: true}},
						limit: 5
					) {
						id
						name
						isUploaded
						bucket {
							id
							presignedUrlsEnabled
						}
					}
				}`,
				Role: "admin",
			},
		},

		// buckets with files
		{
			name: "buckets with files",
			query: query{
				Query: `query {
					buckets(limit: 3) {
						id
						downloadExpiration
						files(limit: 10) {
							id
							name
							size
							mimeType
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "buckets with uploaded files",
			query: query{
				Query: `query {
					buckets(limit: 3) {
						id
						files(where: {isUploaded: {_eq: true}}, limit: 10) {
							id
							name
							isUploaded
						}
					}
				}`,
				Role: "admin",
			},
		},

		// kb_entries with uploader
		{
			name: "kb_entries with uploader",
			query: query{
				Query: `query {
					kb_entries(limit: 5) {
						id
						title
						summary
						uploader {
							id
							displayName
							email
						}
					}
				}`,
				Role: "admin",
			},
		},

		// kb_entries with departments
		{
			name: "kb_entries with departments",
			query: query{
				Query: `query {
					kb_entries(limit: 5) {
						id
						title
						kb_entry_departments {
							id
							department_id
						}
					}
				}`,
				Role: "admin",
			},
		},

		// authRoles with userRoles
		{
			name: "authRoles with userRoles",
			query: query{
				Query: `query {
					authRoles {
						role
						userRoles(limit: 10) {
							id
							userId
							createdAt
						}
					}
				}`,
				Role: "admin",
			},
		},

		// authRoles with usersByDefaultRole
		{
			name: "authRoles with usersByDefaultRole",
			query: query{
				Query: `query {
					authRoles {
						role
						usersByDefaultRole(limit: 10) {
							id
							displayName
							defaultRole
						}
					}
				}`,
				Role: "admin",
			},
		},

		// authProviders with userProviders
		{
			name: "authProviders with userProviders",
			query: query{
				Query: `query {
					authProviders {
						id
						userProviders(limit: 10) {
							id
							userId
							providerUserId
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Two-level nested queries
		{
			name: "users with departments and department details",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						departments {
							role
							department {
								id
								name
								description
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with roles and role details",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						roles {
							id
							role
							roleByRole {
								role
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with userProviders and provider details",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						userProviders {
							id
							providerId
							provider {
								id
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with employees and user details",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						name
						employees(limit: 10) {
							role
							user {
								id
								displayName
								email
								locale
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with files and file details",
			query: query{
				Query: `query {
					departments(limit: 3) {
						id
						name
						files(limit: 5) {
							id
							description
							file {
								id
								name
								size
								mimeType
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "kb_entries with uploader and uploader departments",
			query: query{
				Query: `query {
					kb_entries(limit: 5) {
						id
						title
						uploader {
							id
							displayName
							departments(limit: 5) {
								role
								is_active
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "kb_entries with departments and department details",
			query: query{
				Query: `query {
					kb_entries(limit: 5) {
						id
						title
						kb_entry_departments {
							id
							department {
								id
								name
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "files with department_file and department",
			query: query{
				Query: `query {
					files(limit: 5) {
						id
						name
						department_file {
							id
							description
							department {
								id
								name
								description
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "buckets with files and department_file",
			query: query{
				Query: `query {
					buckets(limit: 2) {
						id
						files(limit: 5) {
							id
							name
							department_file {
								id
								description
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Three-level nested queries
		{
			name: "users with departments with department with files",
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
			name: "users with departments with department with employees",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							role
							department {
								id
								name
								employees(limit: 10) {
									role
									is_active
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with employees with user with roles",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						employees(limit: 5) {
							role
							user {
								id
								displayName
								roles(limit: 5) {
									id
									role
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with employees with user with kbEntries",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						employees(limit: 5) {
							user {
								id
								displayName
								kbEntries(limit: 3) {
									id
									title
									summary
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with files with file with bucket",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						files(limit: 5) {
							id
							file {
								id
								name
								bucket {
									id
									maxUploadFileSize
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "kb_entries with uploader with departments with department",
			query: query{
				Query: `query {
					kb_entries(limit: 3) {
						id
						title
						uploader {
							id
							displayName
							departments(limit: 5) {
								department {
									id
									name
									budget
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "kb_entries with departments with department with employees",
			query: query{
				Query: `query {
					kb_entries(limit: 3) {
						id
						title
						kb_entry_departments(limit: 3) {
							id
							department {
								id
								name
								employees(limit: 10) {
									role
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Complex nested queries with filtering
		{
			name: "active users with active departments and department details",
			query: query{
				Query: `query {
					users(
						where: {disabled: {_eq: false}},
						limit: 5
					) {
						id
						displayName
						departments(
							where: {is_active: {_eq: true}},
							limit: 5
						) {
							role
							department {
								id
								name
								budget
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "users with filtered roles and filtered departments",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						roles(where: {role: {_eq: "admin"}}) {
							id
							role
						}
						departments(where: {is_active: {_eq: true}}) {
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with budget filter with active employees",
			query: query{
				Query: `query {
					departments(
						where: {budget: {_gt: 1000}},
						limit: 5
					) {
						id
						name
						budget
						employees(
							where: {is_active: {_eq: true}},
							limit: 10
						) {
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
			name: "kb_entries with title search with uploader departments",
			query: query{
				Query: `query {
					kb_entries(
						where: {title: {_ilike: "%test%"}},
						limit: 5
					) {
						id
						title
						uploader {
							id
							displayName
							departments(
								where: {is_active: {_eq: true}},
								limit: 5
							) {
								department {
									id
									name
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Complex nested queries with ordering
		{
			name: "users ordered with departments ordered",
			query: query{
				Query: `query {
					users(
						order_by: {displayName: asc},
						limit: 5
					) {
						id
						displayName
						departments(
							order_by: {joined_at: desc},
							limit: 5
						) {
							role
							joined_at
							department {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments ordered with employees ordered",
			query: query{
				Query: `query {
					departments(
						order_by: {name: asc},
						limit: 5
					) {
						id
						name
						employees(
							order_by: {joined_at: desc},
							limit: 10
						) {
							joined_at
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
			name: "kb_entries ordered with uploader and ordered kbEntries",
			query: query{
				Query: `query {
					kb_entries(
						order_by: {created_at: desc},
						limit: 5
					) {
						id
						title
						created_at
						uploader {
							id
							displayName
							kbEntries(
								order_by: {created_at: desc},
								limit: 5
							) {
								id
								title
								created_at
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Multiple relationships in one query
		{
			name: "users with all relationships",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						email
						roles(limit: 5) {
							id
							role
						}
						departments(limit: 5) {
							role
						}
						kbEntries(limit: 3) {
							id
							title
						}
						refreshTokens(limit: 3) {
							id
							createdAt
						}
						securityKeys(limit: 3) {
							id
							credentialId
						}
						userProviders(limit: 3) {
							id
							providerId
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with all relationships",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						description
						budget
						employees(limit: 5) {
							role
						}
						files(limit: 5) {
							id
							description
						}
						kb_entry_departments(limit: 5) {
							id
							kb_entry_id
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nested queries with aliases
		{
			name: "users with aliased relationships",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						adminRoles: roles(where: {role: {_eq: "admin"}}) {
							id
							role
						}
						userRoles: roles(where: {role: {_eq: "user"}}) {
							id
							role
						}
						activeDepartments: departments(where: {is_active: {_eq: true}}) {
							role
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

		// Four-level nested queries
		{
			name: "users with departments with department with employees with user",
			query: query{
				Query: `query {
					users(limit: 1) {
						id
						displayName
						departments(limit: 2) {
							department {
								id
								name
								employees(limit: 5) {
									user {
										id
										displayName
										email
									}
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with employees with user with roles with roleByRole",
			query: query{
				Query: `query {
					departments(limit: 2) {
						id
						name
						employees(limit: 3) {
							user {
								id
								displayName
								roles(limit: 5) {
									id
									role
									roleByRole {
										role
									}
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "kb_entries with departments with department with employees with user",
			query: query{
				Query: `query {
					kb_entries(limit: 2) {
						id
						title
						kb_entry_departments(limit: 2) {
							id
							department {
								id
								name
								employees(limit: 5) {
									user {
										id
										displayName
									}
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nested queries with fragments
		{
			name: "users with departments using fragments",
			query: query{
				Query: `query {
					users(limit: 3) {
						...UserBasic
						departments(limit: 5) {
							...DepartmentMembership
						}
					}
				}
				fragment UserBasic on users {
					id
					displayName
					email
				}
				fragment DepartmentMembership on user_departments {
					role
					is_active
					department {
						id
						name
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with employees using fragments",
			query: query{
				Query: `query {
					departments(limit: 3) {
						...DepartmentInfo
						employees(limit: 10) {
							...EmployeeInfo
						}
					}
				}
				fragment DepartmentInfo on departments {
					id
					name
					description
					budget
				}
				fragment EmployeeInfo on user_departments {
					role
					is_active
					user {
						id
						displayName
					}
				}`,
				Role: "admin",
			},
		},

		// Nested queries with complex filtering
		{
			name: "users with AND filtering on multiple nested levels",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{emailVerified: {_eq: true}}
							]
						},
						limit: 5
					) {
						id
						displayName
						departments(
							where: {
								_and: [
									{is_active: {_eq: true}},
									{role: {_is_null: false}}
								]
							},
							limit: 5
						) {
							role
							department {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "departments with OR filtering on nested employees",
			query: query{
				Query: `query {
					departments(limit: 5) {
						id
						name
						employees(
							where: {
								_or: [
									{role: {_eq: manager}},
									{role: {_eq: member}}
								]
							},
							limit: 10
						) {
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

		// Edge cases with nested queries
		{
			name: "users with empty nested results",
			query: query{
				Query: `query {
					users(limit: 5) {
						id
						displayName
						roles(where: {role: {_eq: "nonexistent_role"}}) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "nested queries with limit 0",
			query: query{
				Query: `query {
					users(limit: 3) {
						id
						displayName
						roles(limit: 0) {
							id
							role
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Same entity appearing multiple times in query
		{
			name: "users with departments and kb_entries both referencing users",
			query: query{
				Query: `query {
					users(limit: 2) {
						id
						displayName
						departments(limit: 3) {
							department {
								id
								name
								employees(limit: 5) {
									user {
										id
										displayName
									}
								}
							}
						}
						kbEntries(limit: 3) {
							id
							title
							uploader {
								id
								displayName
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Circular references through multiple hops
		{
			name: "users circular through department employees",
			query: query{
				Query: `query {
					users(limit: 1) {
						id
						displayName
						departments(limit: 2) {
							department {
								id
								name
								employees(limit: 5) {
									user {
										id
										displayName
										email
									}
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nested with distinct
		{
			name: "users with distinct departments",
			query: query{
				Query: `query {
					users(distinct_on: [locale], limit: 5) {
						id
						locale
						displayName
						departments(limit: 5) {
							role
							department {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Mixed ordering directions in nested queries
		{
			name: "nested queries with mixed ordering",
			query: query{
				Query: `query {
					users(
						order_by: [{disabled: asc}, {displayName: desc}],
						limit: 5
					) {
						id
						displayName
						disabled
						departments(
							order_by: [{is_active: desc}, {joined_at: asc}],
							limit: 5
						) {
							role
							is_active
							joined_at
							department {
								id
								name
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Nested queries with nulls
		{
			name: "users with null email filtering nested",
			query: query{
				Query: `query {
					users(
						where: {email: {_is_null: false}},
						limit: 5
					) {
						id
						displayName
						email
						departments(limit: 5) {
							role
							department {
								id
								name
								description
							}
						}
					}
				}`,
				Role: "admin",
			},
		},

		// Complex multi-level with all features
		{
			name: "complex multi-level with filtering, ordering, and limits",
			query: query{
				Query: `query {
					users(
						where: {
							_and: [
								{disabled: {_eq: false}},
								{emailVerified: {_eq: true}}
							]
						},
						order_by: {displayName: asc},
						limit: 3
					) {
						id
						displayName
						email
						roles(
							where: {role: {_in: ["user", "admin"]}},
							order_by: {createdAt: desc},
							limit: 5
						) {
							id
							role
							createdAt
						}
						departments(
							where: {is_active: {_eq: true}},
							order_by: {joined_at: desc},
							limit: 3
						) {
							role
							joined_at
							department {
								id
								name
								budget
								employees(
									where: {is_active: {_eq: true}},
									order_by: {joined_at: desc},
									limit: 5
								) {
									role
									user {
										id
										displayName
									}
								}
							}
						}
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation: false,
	})
}
