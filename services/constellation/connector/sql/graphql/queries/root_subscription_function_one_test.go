package queries_test

import (
	"testing"
)

func TestBuildSubscriptionFunctionOneSQL(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "simple select",
			query: query{
				Query: `
					subscription {
						get_department_manager(args: {department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"}) {
							department_id
							user_id
							role
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "with nested relationship",
			query: query{
				Query: `
					subscription {
						get_department_manager(args: {department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"}) {
							user {
								displayName
							}
							department {
								name
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "permissions: user",
			query: query{
				Query: `
					subscription {
						get_department_manager(args: {department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"}) {
							department_id
							role
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{2db9de0a-b9ba-416e-8619-783a399ae2b3,fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},

		{
			name: "permissions: user - no access",
			query: query{
				Query: `
					subscription {
						get_department_manager(args: {department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"}) {
							department_id
							role
						}
					}`,
				Role: "user",
				SessionVariables: map[string]any{
					"x-hasura-departments": "{fd1e6bba-c292-4b2f-872e-ae16146cdd82}",
				},
			},
		},
	}

	testBuildSubscription(t, cases, false)
}
