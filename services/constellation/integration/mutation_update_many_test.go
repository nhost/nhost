package integration_test

import (
	"testing"
)

func TestUpdateManyMutations(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "update_many with two simple updates",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { name: "HR Department" }
							},
							{
								where: { id: { _eq: "a7e1c8f0-5a3b-4d2e-9f8c-1b4a5c6d7e8f" } }
								_set: { name: "IT Department", budget: 120000 }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with variables",
			query: query{
				Query: `mutation UpdateManyDepartments($updates: [departments_updates!]!) {
					update_departments_many(updates: $updates) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Variables: map[string]any{
					"updates": []any{
						map[string]any{
							"where": map[string]any{
								"id": map[string]any{
									"_eq": "2db9de0a-b9ba-416e-8619-783a399ae2b3",
								},
							},
							"_set": map[string]any{
								"name": "Human Resources",
							},
						},
						map[string]any{
							"where": map[string]any{
								"name": map[string]any{
									"_like": "IT%",
								},
							},
							"_set": map[string]any{
								"budget": 150000,
							},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_many returning only affected_rows",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { budget: { _lt: 50000 } }
								_set: { budget: 50000 }
							},
							{
								where: { budget: { _gt: 200000 } }
								_set: { budget: 200000 }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with three updates",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_set: { budget: 100000 }
							},
							{
								where: { name: { _eq: "Sales" } }
								_set: { budget: 80000 }
							},
							{
								where: { name: { _eq: "Marketing" } }
								_set: { budget: 90000 }
							}
						]
					) {
						affected_rows
						returning {
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with complex where clauses",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: {
									_and: [
										{ budget: { _gte: 50000 } }
										{ budget: { _lte: 100000 } }
									]
								}
								_set: { description: "Mid-range budget department" }
							},
							{
								where: {
									_or: [
										{ name: { _like: "%Tech%" } }
										{ name: { _like: "%IT%" } }
									]
								}
								_set: { description: "Technology department" }
							}
						]
					) {
						affected_rows
						returning {
							name
							description
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with single update",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { id: { _eq: "2db9de0a-b9ba-416e-8619-783a399ae2b3" } }
								_set: { name: "Updated Department" }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with _inc - increment budgets",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Engineering" } }
								_inc: { budget: 15000 }
							},
							{
								where: { name: { _eq: "Sales" } }
								_inc: { budget: 20000 }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with both _set and _inc",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _eq: "Marketing" } }
								_set: { description: "Updated marketing" }
								_inc: { budget: 10000 }
							},
							{
								where: { budget: { _lt: 500000 } }
								_inc: { budget: 25000 }
							}
						]
					) {
						affected_rows
						returning {
							id
							name
							description
							budget
						}
					}
				}`,
				Role: "admin",
			},
		},

		{
			name: "update_many with _inc using variables",
			query: query{
				Query: `mutation UpdateManyDepartments($updates: [departments_updates!]!) {
					update_departments_many(updates: $updates) {
						affected_rows
						returning {
							id
							name
							budget
						}
					}
				}`,
				Variables: map[string]any{
					"updates": []any{
						map[string]any{
							"where": map[string]any{
								"budget": map[string]any{
									"_gte": 100000,
								},
							},
							"_inc": map[string]any{
								"budget": 50000,
							},
						},
						map[string]any{
							"where": map[string]any{
								"budget": map[string]any{
									"_lt": 100000,
								},
							},
							"_inc": map[string]any{
								"budget": -5000,
							},
						},
					},
				},
				Role: "admin",
			},
		},

		{
			name: "update_many with _inc only returning affected_rows",
			query: query{
				Query: `mutation {
					update_departments_many(
						updates: [
							{
								where: { name: { _like: "%Tech%" } }
								_inc: { budget: 30000 }
							}
						]
					) {
						affected_rows
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{
		IsMutation:           true,
		ReinitBetweenQueries: true,
	})
}
