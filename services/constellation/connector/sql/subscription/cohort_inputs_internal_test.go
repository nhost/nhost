package subscription

import "testing"

func TestBuildSubscriberInputsAlignsSessionVars(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		subscriptions map[string]*cohortSubscription
		wantByID      map[string]map[string]any
	}{
		{
			name: "heterogeneous key sets",
			subscriptions: map[string]*cohortSubscription{
				"a": newCohortSubscription(
					"sub-a",
					map[string]any{"x-hasura-user-id": "user-a"},
					nil,
				),
				"b": newCohortSubscription(
					"sub-b",
					map[string]any{
						"x-hasura-user-id": "user-b",
						"x-hasura-org-id":  "org-b",
					},
					nil,
				),
			},
			wantByID: map[string]map[string]any{
				"sub-a": {
					"x-hasura-user-id": "user-a",
					"x-hasura-org-id":  nil,
				},
				"sub-b": {
					"x-hasura-user-id": "user-b",
					"x-hasura-org-id":  "org-b",
				},
			},
		},
		{
			name: "identical key sets",
			subscriptions: map[string]*cohortSubscription{
				"a": newCohortSubscription(
					"sub-a",
					map[string]any{
						"x-hasura-user-id": "user-a",
						"x-hasura-org-id":  "org-a",
					},
					nil,
				),
				"b": newCohortSubscription(
					"sub-b",
					map[string]any{
						"x-hasura-user-id": "user-b",
						"x-hasura-org-id":  "org-b",
					},
					nil,
				),
			},
			wantByID: map[string]map[string]any{
				"sub-a": {
					"x-hasura-user-id": "user-a",
					"x-hasura-org-id":  "org-a",
				},
				"sub-b": {
					"x-hasura-user-id": "user-b",
					"x-hasura-org-id":  "org-b",
				},
			},
		},
		{
			name: "empty session vars",
			subscriptions: map[string]*cohortSubscription{
				"a": newCohortSubscription("sub-a", nil, nil),
				"b": newCohortSubscription("sub-b", nil, nil),
			},
			wantByID: map[string]map[string]any{
				"sub-a": {},
				"sub-b": {},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			subIDs, sessionVarArrays := buildSubscriberInputs(tc.subscriptions)

			assertAlignedVars(t, subIDs, sessionVarArrays, tc.wantByID)
		})
	}
}

func TestBuildStreamSubscriberInputsAlignsVars(t *testing.T) {
	t.Parallel()

	subscriptions := map[string]*streamCohortSubscription{
		"a": newStreamCohortSubscription(
			"sub-a",
			map[string]any{"x-hasura-user-id": "user-a"},
			map[string]any{"limit": 10},
			nil,
		),
		"b": newStreamCohortSubscription(
			"sub-b",
			map[string]any{
				"x-hasura-user-id": "user-b",
				"x-hasura-org-id":  "org-b",
			},
			map[string]any{
				"limit":  10,
				"offset": 20,
			},
			nil,
		),
	}

	subIDs, sessionVarArrays, graphQLVarArrays := buildStreamSubscriberInputs(subscriptions)

	assertAlignedVars(t, subIDs, sessionVarArrays, map[string]map[string]any{
		"sub-a": {
			"x-hasura-user-id": "user-a",
			"x-hasura-org-id":  nil,
		},
		"sub-b": {
			"x-hasura-user-id": "user-b",
			"x-hasura-org-id":  "org-b",
		},
	})
	assertAlignedVars(t, subIDs, graphQLVarArrays, map[string]map[string]any{
		"sub-a": {
			"limit":  10,
			"offset": nil,
		},
		"sub-b": {
			"limit":  10,
			"offset": 20,
		},
	})
}

func TestBuildStreamTemplateVarsUsesFirstNonNilGraphQLValue(t *testing.T) {
	t.Parallel()

	_, graphQLVars := buildStreamTemplateVars(
		map[string][]any{"x-hasura-user-id": {"user-a", "user-b"}},
		map[string][]any{
			"limit":  {nil, 10},
			"offset": {nil, nil},
		},
	)

	if graphQLVars["limit"] != 10 {
		t.Errorf("limit = %v, want 10", graphQLVars["limit"])
	}

	if _, exists := graphQLVars["offset"]; !exists {
		t.Fatal("offset missing from template GraphQL variables")
	}

	if graphQLVars["offset"] != nil {
		t.Errorf("offset = %v, want nil", graphQLVars["offset"])
	}
}

func assertAlignedVars(
	t *testing.T,
	subIDs []string,
	varArrays map[string][]any,
	wantByID map[string]map[string]any,
) {
	t.Helper()

	if len(subIDs) != len(wantByID) {
		t.Fatalf("subIDs length = %d, want %d", len(subIDs), len(wantByID))
	}

	indexByID := make(map[string]int, len(subIDs))
	for index, subID := range subIDs {
		indexByID[subID] = index
	}

	wantVars := make(map[string]struct{})
	for subID, vars := range wantByID {
		if _, exists := indexByID[subID]; !exists {
			t.Fatalf("subIDs missing %s", subID)
		}

		for varName := range vars {
			wantVars[varName] = struct{}{}
		}
	}

	for varName, arr := range varArrays {
		if _, expected := wantVars[varName]; !expected {
			t.Errorf("unexpected variable array %s", varName)
		}

		if len(arr) != len(subIDs) {
			t.Errorf("%s length = %d, want %d", varName, len(arr), len(subIDs))
		}
	}

	for varName := range wantVars {
		if _, exists := varArrays[varName]; !exists {
			t.Errorf("missing variable array %s", varName)
		}
	}

	for subID, vars := range wantByID {
		index := indexByID[subID]
		for varName, want := range vars {
			arr := varArrays[varName]
			if index >= len(arr) {
				t.Fatalf(
					"%s index %d out of range for %s length %d",
					subID,
					index,
					varName,
					len(arr),
				)
			}

			if got := arr[index]; got != want {
				t.Errorf("%s[%s] = %v, want %v", subID, varName, got, want)
			}
		}
	}
}
