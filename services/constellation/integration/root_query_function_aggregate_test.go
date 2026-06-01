package integration_test

import (
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestBuildQueryFunctionAggregateSQL(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "count only",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "count only (custom name)",
			query: query{
				Query: `
					query {
						searchNews_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "count only (custom root field)",
			query: query{
				Query: `
					query {
						searchNewsAggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "count with nodes",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}, limit: 5) {
							aggregate {
								count
							}
							nodes {
								id
								content
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "with where clause",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {is_public: {_eq: true}}
						) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "with order_by and limit",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							order_by: {created_at: desc},
							limit: 10
						) {
							aggregate {
								count
							}
							nodes {
								id
								content
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Positive parity case for the aggregate path: admin querying both
			// aggregate { count } and nodes returns data and compares cleanly to
			// Hasura. (Previously this slot held a negative-permission subcase
			// for the public role, which depended on validation-error text:
			// Constellation's gqlparser emits 'Did you mean' field suggestions in
			// validation errors; Hasura does not — tracked separately.)
			name: "aggregate with count and nodes",
			query: query{
				Query: `
					query {
						search_news_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
							nodes {
								id
								content
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			name: "permissions: user with session variables",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {department: {budget: {_gt: 1}}}
						) {
							aggregate {
								count
							}
							nodes {
								content
								department {
									name
								}
							}
						}
					}`,
				Role: "user",
				SessionVariables: map[string]string{
					"departments": `{"2db9de0a-b9ba-416e-8619-783a399ae2b3","fd1e6bba-c292-4b2f-872e-ae16146cdd82"}`,
				},
			},
		},

		{
			name: "nested relationship filter",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							where: {author: {displayName: {_eq: "Sarah Martinez"}}}
						) {
							aggregate {
								count
							}
							nodes {
								id
								content
								author {
									displayName
								}
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Defaulted argument omitted on the aggregate path: must succeed
			// end-to-end and apply the function's declared default (max_len =
			// 220), matching Hasura. The default is observable on the count: the
			// seeded `news` rows matching "a" have content lengths in the
			// 194-228 band, so applying max_len = 220 counts the three rows of
			// length <= 220 (a distinct, NON-ZERO count). A regression that
			// bound NULL or 0 instead of the declared default would count zero
			// rows and diverge from Hasura, failing this case.
			name: "defaulted arg omitted",
			query: query{
				Query: `
					query {
						search_news_default_aggregate(args: {search: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Mirrors the collection-path observable check on the aggregate path:
			// the supplied max_len must actually filter the counted rows, not fall
			// back to the declared default of 220. The seeded rows matching "a" all
			// have content lengths in the 194-228 band, so max_len=200 counts
			// exactly one row while the declared default of 220 counts three. A
			// regression that ignored the supplied argument would report a different
			// count than Hasura and fail this case.
			name: "defaulted arg supplied",
			query: query{
				Query: `
					query {
						search_news_default_aggregate(args: {search: "a", max_len: 200}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Positional-only omitted default on the aggregate path. The default is
			// observable for the same reason as the collection-path test: applying
			// arg_2's declared default of 220 counts three rows, while binding NULL
			// or 0 would count zero.
			name: "positional-only function defaulted arg omitted",
			query: query{
				Query: `
					query {
						search_news_positional_aggregate(args: {arg_1: "a"}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		{
			// Positional-only supplied default on the aggregate path. arg_2=200
			// must count the single 194-length row instead of falling back to the
			// declared default of 220, which counts three rows.
			name: "positional-only function defaulted arg supplied",
			query: query{
				Query: `
					query {
						search_news_positional_aggregate(args: {arg_1: "a", arg_2: 200}) {
							aggregate {
								count
							}
						}
					}`,
				Role: "admin",
			},
		},

		// Hasura-parity lock for the function-aggregate argumentPath surface. The
		// aggregate function root runs distinct_on/order_by through the same
		// validation as the table aggregate root, so a distinct_on whose column
		// set does not match the leading order_by column is rejected at query
		// validation with a "validation-failed" envelope whose extensions.path is
		// the function root field: "$.selectionSet.search_news_aggregate.args".
		// RunGraphQLTests diffs the full response against live Hasura, pinning
		// message, extensions.code, and extensions.path.
		{
			name: "distinct_on/order_by mismatch validation error",
			query: query{
				Query: `
					query {
						search_news_aggregate(
							args: {search: "a"},
							distinct_on: title,
							order_by: {created_at: desc}
						) {
							aggregate {
								count
							}
							nodes {
								id
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

// queryRootFieldNameSet runs the query_root field-name introspection query
// against url for role and returns the set of exposed field names. It fails
// the test on any transport error or unexpected response shape so a missing
// field list surfaces as a hard error rather than an empty (false-passing)
// set.
func queryRootFieldNameSet(
	t *testing.T,
	url, role string,
) map[string]struct{} {
	t.Helper()

	headers := http.Header{
		"x-hasura-admin-secret": []string{adminSecret},
		"x-hasura-role":         []string{role},
	}

	resp, err := makeHTTPQuery(t.Context(), url, query{
		Query: `
			query {
				__type(name: "query_root") {
					fields {
						name
					}
				}
			}`,
		Role: role,
	}, headers)
	if err != nil {
		t.Fatalf("introspection query to %s failed: %v", url, err)
	}

	body, ok := resp.(map[string]any)
	if !ok {
		t.Fatalf("unexpected response from %s: %#v", url, resp)
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data in response from %s: %#v", url, body)
	}

	typeField, ok := data["__type"].(map[string]any)
	if !ok {
		t.Fatalf("missing __type in response from %s: %#v", url, data)
	}

	fields, ok := typeField["fields"].([]any)
	if !ok {
		t.Fatalf("missing __type.fields in response from %s: %#v", url, typeField)
	}

	names := make(map[string]struct{}, len(fields))

	for _, f := range fields {
		field, ok := f.(map[string]any)
		if !ok {
			t.Fatalf("unexpected field entry from %s: %#v", url, f)
		}

		name, ok := field["name"].(string)
		if !ok {
			t.Fatalf("missing field name from %s: %#v", url, field)
		}

		names[name] = struct{}{}
	}

	return names
}

// TestQueryFunctionAggregatePublicPermission asserts the public-role permission
// invariant for the aggregate path: the public role is granted select on `news`
// WITHOUT allow_aggregations, so `search_news_aggregate` must not appear in the
// public query_root.
//
// This is verified directly as a set membership rather than through
// RunGraphQLTests: the harness compares the ordered __type.fields[] array with
// cmp.Diff, but query_root field order is not part of Constellation's
// Hasura-compatibility contract (Hasura sorts the fields; Constellation emits
// them in schema-build insertion order), so an ordered comparison would fail on
// ordering alone even when both backends expose exactly the same fields.
// Comparing the field-name sets isolates the property under test. We also assert
// the two sets are equal so a regression that drops a legitimate public field is
// still caught, while remaining order-independent.
//
// The prior negative subcase asserted on a validation-error string for the
// denied field, but Constellation's gqlparser emits "Did you mean" field
// suggestions in validation errors and Hasura does not; that divergence is
// tracked separately.
//
// The query introspects the schema only, so it does not depend on seeded row
// data and intentionally skips ReinitializeTestData.
func TestQueryFunctionAggregatePublicPermission(t *testing.T) {
	t.Parallel()

	const (
		role         = "public"
		aggregate    = "search_news_aggregate"
		collectionFn = "search_news"
	)

	hasura := queryRootFieldNameSet(t, hasuraURL, role)
	constellation := queryRootFieldNameSet(t, constellationURL, role)

	if _, exposed := hasura[aggregate]; exposed {
		t.Errorf("hasura unexpectedly exposes %q to the public role", aggregate)
	}

	if _, exposed := constellation[aggregate]; exposed {
		t.Errorf("constellation unexpectedly exposes %q to the public role", aggregate)
	}

	// The non-aggregate collection function is granted to public and must stay
	// exposed; this guards against an over-broad fix that hides the function
	// entirely instead of only its aggregate.
	if _, exposed := constellation[collectionFn]; !exposed {
		t.Errorf("constellation should expose %q to the public role", collectionFn)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("public query_root field sets differ (-hasura +constellation):\n%s", diff)
	}
}
