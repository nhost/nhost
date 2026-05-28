package activity

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

// ----- helpers ---------------------------------------------------------------

const (
	testUser     = "alice"
	testOtherUsr = "bob"
	testRepo     = "nhost/example"
)

func windowParams() Params {
	since := time.Date(2026, 5, 20, 9, 0, 0, 0, time.UTC)
	until := time.Date(2026, 5, 20, 17, 0, 0, 0, time.UTC)

	return Params{
		Org:           "nhost",
		User:          testUser,
		Since:         since,
		Until:         until,
		ReadyStatus:   "Ready for review",
		WaitingStatus: "Waiting",
	}
}

func ts(p Params, offset time.Duration) string {
	return p.Since.Add(offset).Format(time.RFC3339)
}

// inWindowTS returns a timestamp safely inside [Since, Until].
func inWindowTS(p Params) string { return ts(p, 1*time.Hour) }

// outOfWindowTS returns a timestamp comfortably before Since.
func outOfWindowTS(p Params) string {
	return p.Since.Add(-48 * time.Hour).Format(time.RFC3339)
}

func authoredPR() searchNode {
	return searchNode{
		Typename: "PullRequest",
		Number:   1,
		Title:    "Authored PR",
		URL:      "https://github.com/nhost/example/pull/1",
		Author:   &actor{Login: testUser},
		Repository: struct {
			NameWithOwner string `json:"nameWithOwner"`
		}{NameWithOwner: testRepo},
	}
}

func nonAuthoredPR() searchNode {
	n := authoredPR()
	n.Number = 2
	n.Title = "Non-authored PR"
	n.URL = "https://github.com/nhost/example/pull/2"
	n.Author = &actor{Login: testOtherUsr}

	return n
}

func authoredIssue() searchNode {
	return searchNode{
		Typename: "Issue",
		Number:   10,
		Title:    "Authored issue",
		URL:      "https://github.com/nhost/example/issues/10",
		Author:   &actor{Login: testUser},
		Repository: struct {
			NameWithOwner string `json:"nameWithOwner"`
		}{NameWithOwner: testRepo},
	}
}

// onlyItem returns the single Item from whichever bucket holds it, plus the
// bucket name. Fails the test if zero or more than one bucket has entries.
func onlyItem(t *testing.T, r *Report) (string, Item) {
	t.Helper()

	buckets := map[string][]Item{
		"InProgress":     r.InProgress,
		"ReadyForReview": r.ReadyForReview,
		"Blocked":        r.Blocked,
		"ClosedOrMerged": r.ClosedOrMerged,
		"Uncategorized":  r.Uncategorized,
	}

	var (
		gotBucket string
		gotItem   Item
		hits      int
	)

	for name, items := range buckets {
		if len(items) > 0 {
			hits += len(items)
			gotBucket = name
			gotItem = items[0]
		}
	}

	if hits != 1 {
		t.Fatalf("expected exactly one bucketed item, got %d: %+v", hits, r)
	}

	return gotBucket, gotItem
}

func bucketCounts(r *Report) map[string]int {
	return map[string]int{
		"InProgress":     len(r.InProgress),
		"ReadyForReview": len(r.ReadyForReview),
		"Blocked":        len(r.Blocked),
		"ClosedOrMerged": len(r.ClosedOrMerged),
		"Uncategorized":  len(r.Uncategorized),
	}
}

// ----- classifyPR ------------------------------------------------------------

func TestClassifyPR_BucketPriority(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)

	// Build a PR that satisfies every bucket's signal. Priority order
	// (top wins): ClosedOrMerged > Blocked > ReadyForReview > InProgress >
	// Uncategorized. We then peel signals off the top and check the next bucket
	// fires.

	full := authoredPR()
	full.MergedAt = in
	full.ClosedAt = in
	full.CreatedAt = in
	full.ProjectItems.Nodes = []projectItem{
		{
			Project: struct {
				Title  string `json:"title"`
				Number int    `json:"number"`
			}{Title: "Eng", Number: 1},
			FieldValueByName: &struct {
				Typename  string `json:"__typename"`
				Name      string `json:"name"`
				UpdatedAt string `json:"updatedAt"`
			}{Typename: "ProjectV2ItemFieldSingleSelectValue", Name: p.WaitingStatus, UpdatedAt: in},
		},
		{
			Project: struct {
				Title  string `json:"title"`
				Number int    `json:"number"`
			}{Title: "Eng", Number: 2},
			FieldValueByName: &struct {
				Typename  string `json:"__typename"`
				Name      string `json:"name"`
				UpdatedAt string `json:"updatedAt"`
			}{Typename: "ProjectV2ItemFieldSingleSelectValue", Name: p.ReadyStatus, UpdatedAt: in},
		},
	}
	full.TimelineItems.Nodes = []timelineItem{
		{Typename: "ReadyForReviewEvent", CreatedAt: in, Actor: &actor{Login: testUser}},
		{Typename: "IssueComment", CreatedAt: in, Author: &actor{Login: testUser}},
	}

	tests := []struct {
		name string
		mut  func(n *searchNode)
		want string
	}{
		{
			name: "ClosedOrMerged wins when MergedAt is in window",
			mut:  func(_ *searchNode) {},
			want: "ClosedOrMerged",
		},
		{
			name: "Blocked wins when ClosedOrMerged signals are gone",
			mut: func(n *searchNode) {
				n.MergedAt = ""
				n.ClosedAt = ""
			},
			want: "Blocked",
		},
		{
			name: "ReadyForReview wins when ClosedOrMerged and Blocked signals are gone",
			mut: func(n *searchNode) {
				n.MergedAt = ""
				n.ClosedAt = ""
				// Drop the Waiting project entry.
				n.ProjectItems.Nodes = n.ProjectItems.Nodes[1:]
			},
			want: "ReadyForReview",
		},
		{
			name: "InProgress wins when only CreatedAt-in-window remains",
			mut: func(n *searchNode) {
				n.MergedAt = ""
				n.ClosedAt = ""
				n.ProjectItems.Nodes = nil
				n.TimelineItems.Nodes = nil
			},
			want: "InProgress",
		},
		{
			name: "Uncategorized when only a timeline comment by the user remains",
			mut: func(n *searchNode) {
				n.MergedAt = ""
				n.ClosedAt = ""
				n.CreatedAt = ""
				n.ProjectItems.Nodes = nil
				n.TimelineItems.Nodes = []timelineItem{
					{Typename: "IssueComment", CreatedAt: in, Author: &actor{Login: testUser}},
				}
			},
			want: "Uncategorized",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			n := full
			// Deep-ish copy of nested slices.
			n.ProjectItems.Nodes = append([]projectItem(nil), full.ProjectItems.Nodes...)
			n.TimelineItems.Nodes = append([]timelineItem(nil), full.TimelineItems.Nodes...)
			tt.mut(&n)

			r := &Report{}
			classifyPR(n, p, r)

			gotBucket, gotItem := onlyItem(t, r)
			if gotBucket != tt.want {
				t.Fatalf("classifyPR bucket = %q, want %q (report: %+v)", gotBucket, tt.want, r)
			}

			if gotItem.Number != n.Number || gotItem.Kind != KindPR {
				t.Fatalf("classified item = %+v, want PR #%d", gotItem, n.Number)
			}
		})
	}
}

func TestClassifyPR_NonAuthorRequiresInWindowSignal(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)
	out := outOfWindowTS(p)

	tests := []struct {
		name      string
		node      func() searchNode
		wantCount map[string]int
	}{
		{
			name: "non-authored PR with no in-window user activity is NOT Uncategorized",
			node: func() searchNode {
				n := nonAuthoredPR()
				// Some third-party update bumped `updated`, but the user did
				// nothing inside the window.
				n.TimelineItems.Nodes = []timelineItem{
					{Typename: "IssueComment", CreatedAt: out, Author: &actor{Login: testUser}},
					{Typename: "IssueComment", CreatedAt: in, Author: &actor{Login: "carol"}},
				}

				return n
			},
			wantCount: map[string]int{
				"InProgress": 0, "ReadyForReview": 0, "Blocked": 0,
				"ClosedOrMerged": 0, "Uncategorized": 0,
			},
		},
		{
			name: "non-authored PR with an in-window user review IS Uncategorized",
			node: func() searchNode {
				n := nonAuthoredPR()
				n.TimelineItems.Nodes = []timelineItem{
					{
						Typename:    "PullRequestReview",
						SubmittedAt: in,
						State:       "APPROVED",
						Author:      &actor{Login: testUser},
					},
				}

				return n
			},
			wantCount: map[string]int{
				"InProgress": 0, "ReadyForReview": 0, "Blocked": 0,
				"ClosedOrMerged": 0, "Uncategorized": 1,
			},
		},
		{
			name: "authored PR with no signal at all stays unbucketed",
			node: authoredPR,
			wantCount: map[string]int{
				"InProgress": 0, "ReadyForReview": 0, "Blocked": 0,
				"ClosedOrMerged": 0, "Uncategorized": 0,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			r := &Report{}
			classifyPR(tt.node(), p, r)

			if got := bucketCounts(r); !reflect.DeepEqual(got, tt.wantCount) {
				t.Fatalf("bucket counts = %v, want %v", got, tt.wantCount)
			}
		})
	}
}

func TestClassifyPR_BlockedIgnoresNonAuthor(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)

	// Blocked / ReadyForReview / InProgress all require isAuthor; a non-
	// authored PR with the same project status must not land in Blocked.
	n := nonAuthoredPR()
	n.ProjectItems.Nodes = []projectItem{
		{
			Project: struct {
				Title  string `json:"title"`
				Number int    `json:"number"`
			}{Title: "Eng", Number: 1},
			FieldValueByName: &struct {
				Typename  string `json:"__typename"`
				Name      string `json:"name"`
				UpdatedAt string `json:"updatedAt"`
			}{Typename: "ProjectV2ItemFieldSingleSelectValue", Name: p.WaitingStatus, UpdatedAt: in},
		},
	}

	r := &Report{}
	classifyPR(n, p, r)

	if len(r.Blocked) != 0 {
		t.Fatalf("non-authored PR landed in Blocked: %+v", r.Blocked)
	}
}

func TestClassifyPR_EmptyProjectAndTimelineDoNotPanic(t *testing.T) {
	t.Parallel()

	p := windowParams()

	r := &Report{}
	classifyPR(authoredPR(), p, r)

	if got := bucketCounts(r); got["InProgress"]+got["ReadyForReview"]+
		got["Blocked"]+got["ClosedOrMerged"]+got["Uncategorized"] != 0 {
		t.Fatalf("expected no buckets to fire for empty PR, got %v", got)
	}
}

func TestClassifyPR_InWindowBoundary(t *testing.T) {
	t.Parallel()

	p := windowParams()

	tests := []struct {
		name    string
		ts      time.Time
		wantBkt string
	}{
		{
			name:    "exactly at Since counts as in-window",
			ts:      p.Since,
			wantBkt: "ClosedOrMerged",
		},
		{
			name:    "exactly at Until counts as in-window",
			ts:      p.Until,
			wantBkt: "ClosedOrMerged",
		},
		{
			name:    "one second after Until is out of window",
			ts:      p.Until.Add(1 * time.Second),
			wantBkt: "",
		},
		{
			name:    "one second before Since is out of window",
			ts:      p.Since.Add(-1 * time.Second),
			wantBkt: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			n := authoredPR()
			n.MergedAt = tt.ts.Format(time.RFC3339)

			r := &Report{}
			classifyPR(n, p, r)

			if tt.wantBkt == "" {
				if len(r.ClosedOrMerged) != 0 {
					t.Fatalf("expected nothing in ClosedOrMerged, got %+v", r.ClosedOrMerged)
				}

				return
			}

			if len(r.ClosedOrMerged) != 1 {
				t.Fatalf("expected ClosedOrMerged to fire, got %+v", r)
			}
		})
	}
}

// ----- classifyIssue --------------------------------------------------------

func TestClassifyIssue(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)
	out := outOfWindowTS(p)

	tests := []struct {
		name      string
		node      func() searchNode
		wantCount map[string]int
	}{
		{
			name: "authored issue created in window is Uncategorized",
			node: func() searchNode {
				n := authoredIssue()
				n.CreatedAt = in

				return n
			},
			wantCount: map[string]int{"Uncategorized": 1},
		},
		{
			name: "non-authored issue with user comment in window is Uncategorized",
			node: func() searchNode {
				n := authoredIssue()
				n.Author = &actor{Login: testOtherUsr}
				n.TimelineItems.Nodes = []timelineItem{
					{Typename: "IssueComment", CreatedAt: in, Author: &actor{Login: testUser}},
				}

				return n
			},
			wantCount: map[string]int{"Uncategorized": 1},
		},
		{
			name: "non-authored issue with no user activity is not bucketed",
			node: func() searchNode {
				n := authoredIssue()
				n.Author = &actor{Login: testOtherUsr}
				n.TimelineItems.Nodes = []timelineItem{
					{Typename: "IssueComment", CreatedAt: out, Author: &actor{Login: testUser}},
					{Typename: "IssueComment", CreatedAt: in, Author: &actor{Login: "carol"}},
				}

				return n
			},
			wantCount: map[string]int{},
		},
		{
			name: "authored issue with empty TimelineItems and out-of-window CreatedAt is not bucketed",
			node: func() searchNode {
				n := authoredIssue()
				n.CreatedAt = out

				return n
			},
			wantCount: map[string]int{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			r := &Report{}
			classifyIssue(tt.node(), p, r)

			got := bucketCounts(r)
			for k, v := range tt.wantCount {
				if got[k] != v {
					t.Fatalf("bucket %s = %d, want %d (full: %v)", k, got[k], v, got)
				}
			}

			total := 0
			for _, v := range got {
				total += v
			}

			wantTotal := 0
			for _, v := range tt.wantCount {
				wantTotal += v
			}

			if total != wantTotal {
				t.Fatalf("total bucketed = %d, want %d (full: %v)", total, wantTotal, got)
			}
		})
	}
}

// ----- categorise ----------------------------------------------------------

func TestCategorise_DispatchesByTypename(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)

	pr := authoredPR()
	pr.MergedAt = in

	is := authoredIssue()
	is.CreatedAt = in

	unknown := searchNode{Typename: "Discussion", Number: 99}

	r := categorise([]searchNode{pr, is, unknown}, p)
	if len(r.ClosedOrMerged) != 1 {
		t.Fatalf("expected one ClosedOrMerged item, got %+v", r.ClosedOrMerged)
	}

	if len(r.Uncategorized) != 1 {
		t.Fatalf("expected one Uncategorized item, got %+v", r.Uncategorized)
	}
}

// ----- Build (boundary integration via inline stub) ------------------------

// stubGHClient is an inline implementation of ghClient that returns a canned
// search response. The package's white-box tests cannot import the sibling
// mock/ package (import cycle), so we hand-roll the minimum stub here.
type stubGHClient struct {
	nodes          []searchNode
	calls          int
	gotStatusField string
}

func (s *stubGHClient) GraphQL(
	_ context.Context,
	_ string,
	vars map[string]any,
	out any,
) error {
	s.calls++

	if v, ok := vars["statusField"].(string); ok {
		s.gotStatusField = v
	}

	// Build sends the same query three times (involves / reviewed-by /
	// review-requested). Return the canned payload on the first call and
	// empty on later calls so the dedupe path is exercised once.
	var nodes []searchNode
	if s.calls == 1 {
		nodes = s.nodes
	}

	resp := searchResponse{}
	resp.Search.Nodes = nodes
	resp.Search.PageInfo.HasNextPage = false
	resp.Search.PageInfo.EndCursor = ""

	raw, err := json.Marshal(resp)
	if err != nil {
		return err //nolint:wrapcheck // test stub
	}

	return json.Unmarshal(raw, out) //nolint:wrapcheck // test stub
}

func TestBuild_DedupesAndClassifies(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)

	pr := authoredPR()
	pr.MergedAt = in

	stub := &stubGHClient{nodes: []searchNode{pr}}

	got, err := Build(context.Background(), stub, p)
	if err != nil {
		t.Fatalf("Build returned error: %v", err)
	}

	if stub.calls != 3 {
		t.Fatalf("Build issued %d GraphQL calls, want 3", stub.calls)
	}

	if len(got.ClosedOrMerged) != 1 {
		t.Fatalf("expected one ClosedOrMerged item after dedupe, got %+v", got.ClosedOrMerged)
	}
}

// TestBuild_StatusFieldThreadsThroughGraphQL pins the fix for the hardcoded
// `fieldValueByName(name: "Status")`: the resolved Params.StatusField (with
// the empty-string default applied) must appear in the GraphQL variables, and
// a custom field name with a matching project-status payload must still drive
// the Blocked / ReadyForReview classification.
func TestBuild_StatusFieldThreadsThroughGraphQL(t *testing.T) {
	t.Parallel()

	p := windowParams()
	in := inWindowTS(p)

	// PR that would be Blocked iff its project status is recognised — the
	// classifier itself does not branch on the field *name* (the GraphQL
	// resolver does), so a Blocked classification here pins that Build at
	// least delivered a project payload to the classifier for a custom field.
	pr := authoredPR()
	pr.ProjectItems.Nodes = []projectItem{
		{
			Project: struct {
				Title  string `json:"title"`
				Number int    `json:"number"`
			}{Title: "Eng", Number: 1},
			FieldValueByName: &struct {
				Typename  string `json:"__typename"`
				Name      string `json:"name"`
				UpdatedAt string `json:"updatedAt"`
			}{
				Typename:  "ProjectV2ItemFieldSingleSelectValue",
				Name:      p.WaitingStatus,
				UpdatedAt: in,
			},
		},
	}

	tests := []struct {
		name       string
		statusIn   string
		wantStatus string
	}{
		{
			name:       "empty StatusField falls back to the default",
			statusIn:   "",
			wantStatus: DefaultStatusField,
		},
		{
			name:       "custom StatusField is forwarded verbatim",
			statusIn:   "Workflow Status",
			wantStatus: "Workflow Status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			stub := &stubGHClient{nodes: []searchNode{pr}}

			params := p
			params.StatusField = tt.statusIn

			got, err := Build(context.Background(), stub, params)
			if err != nil {
				t.Fatalf("Build returned error: %v", err)
			}

			if stub.gotStatusField != tt.wantStatus {
				t.Fatalf(
					"GraphQL statusField variable = %q, want %q",
					stub.gotStatusField, tt.wantStatus,
				)
			}

			// The classifier must still see the project payload and route the
			// PR into Blocked (the WaitingStatus signal beats every later
			// branch). This pins that nothing in the new plumbing drops the
			// project data.
			if len(got.Blocked) != 1 {
				t.Fatalf(
					"expected one Blocked item under statusField=%q, got %+v",
					tt.statusIn, got,
				)
			}
		})
	}
}
