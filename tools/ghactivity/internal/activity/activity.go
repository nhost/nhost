// Package activity collects a user's GitHub activity (PRs and issues) for a
// time window and bucketises it into the categories used by ghactivity's
// markdown report.
package activity

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ghClient is the subset of *gh.Client this package depends on. Defining it
// here lets classifier tests stub the GitHub boundary without standing up the
// real `gh` CLI. The interface is unexported, so white-box tests stub it with
// an inline type rather than a generated mock (a `mock/` subpackage would
// create an import cycle).
type ghClient interface {
	GraphQL(ctx context.Context, query string, vars map[string]any, out any) error
}

// Item is a single PR or issue surfaced in the report.
type Item struct {
	Kind       Kind
	Number     int
	Title      string
	URL        string
	Repository string
}

// Kind discriminates PR vs Issue for the renderer.
type Kind string

const (
	KindPR    Kind = "PR"
	KindIssue Kind = "Issue"
)

// Report is the bucketed result of a collection run.
type Report struct {
	InProgress     []Item
	ReadyForReview []Item
	Blocked        []Item
	ClosedOrMerged []Item
	Uncategorized  []Item
}

// Params drives one collection run.
type Params struct {
	Org           string
	User          string
	Since         time.Time
	Until         time.Time
	StatusField   string // Projects v2 single-select field name (defaults to "Status")
	ReadyStatus   string // project column name treated as "ready for review"
	WaitingStatus string // project column name treated as "blocked / waiting"
}

// DefaultStatusField is the Projects v2 single-select field name used when
// Params.StatusField is empty. Exported so the CLI layer can surface the same
// default in flag help.
const DefaultStatusField = "Status"

// Build queries GitHub through the supplied client and returns the bucketed
// report. The client is normally a *gh.Client; the interface boundary exists
// so the classifier can be exercised without spawning the `gh` CLI.
func Build(ctx context.Context, c ghClient, p Params) (*Report, error) {
	if p.StatusField == "" {
		p.StatusField = DefaultStatusField
	}

	since := p.Since.Format(time.RFC3339)
	until := p.Until.Format(time.RFC3339)

	queries := []string{
		fmt.Sprintf("org:%s involves:%s updated:%s..%s", p.Org, p.User, since, until),
		fmt.Sprintf("org:%s reviewed-by:%s updated:%s..%s", p.Org, p.User, since, until),
		fmt.Sprintf("org:%s review-requested:%s updated:%s..%s", p.Org, p.User, since, until),
	}

	seen := make(map[string]struct{})

	var nodes []searchNode
	for _, q := range queries {
		batch, err := runSearch(ctx, c, q, p.StatusField)
		if err != nil {
			return nil, fmt.Errorf("search %q: %w", q, err)
		}

		for _, n := range batch {
			if _, dup := seen[n.URL]; dup {
				continue
			}

			seen[n.URL] = struct{}{}
			nodes = append(nodes, n)
		}
	}

	return categorise(nodes, p), nil
}

const searchQuery = `query($q: String!, $cursor: String, $statusField: String!) {
  search(query: $q, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on PullRequest {
        number title url state isDraft merged
        createdAt closedAt mergedAt
        author { login }
        repository { nameWithOwner }
        commits(last: 30) {
          nodes { commit { committedDate author { user { login } } } }
        }
        timelineItems(last: 100, itemTypes: [
          READY_FOR_REVIEW_EVENT,
          PULL_REQUEST_REVIEW,
          ISSUE_COMMENT,
        ]) {
          nodes {
            __typename
            ... on ReadyForReviewEvent { createdAt actor { login } }
            ... on PullRequestReview { submittedAt state author { login } }
            ... on IssueComment { createdAt author { login } }
          }
        }
        projectItems(first: 10) {
          nodes {
            project { title number }
            fieldValueByName(name: $statusField) {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue { name updatedAt }
            }
          }
        }
      }
      ... on Issue {
        number title url state createdAt closedAt
        author { login }
        repository { nameWithOwner }
        timelineItems(last: 50, itemTypes: [ISSUE_COMMENT]) {
          nodes {
            __typename
            ... on IssueComment { createdAt author { login } }
          }
        }
      }
    }
  }
}`

type searchResponse struct {
	Search struct {
		PageInfo struct {
			HasNextPage bool   `json:"hasNextPage"`
			EndCursor   string `json:"endCursor"`
		} `json:"pageInfo"`
		Nodes []searchNode `json:"nodes"`
	} `json:"search"`
}

type searchNode struct {
	Typename   string `json:"__typename"`
	Number     int    `json:"number"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	State      string `json:"state"`
	IsDraft    bool   `json:"isDraft"`
	Merged     bool   `json:"merged"`
	CreatedAt  string `json:"createdAt"`
	ClosedAt   string `json:"closedAt"`
	MergedAt   string `json:"mergedAt"`
	Author     *actor `json:"author"`
	Repository struct {
		NameWithOwner string `json:"nameWithOwner"`
	} `json:"repository"`
	Commits struct {
		Nodes []struct {
			Commit struct {
				CommittedDate string `json:"committedDate"`
				Author        struct {
					User *actor `json:"user"`
				} `json:"author"`
			} `json:"commit"`
		} `json:"nodes"`
	} `json:"commits"`
	TimelineItems struct {
		Nodes []timelineItem `json:"nodes"`
	} `json:"timelineItems"`
	ProjectItems struct {
		Nodes []projectItem `json:"nodes"`
	} `json:"projectItems"`
}

type actor struct {
	Login string `json:"login"`
}

type timelineItem struct {
	Typename    string `json:"__typename"`
	CreatedAt   string `json:"createdAt"`
	SubmittedAt string `json:"submittedAt"`
	State       string `json:"state"`
	Actor       *actor `json:"actor"`
	Author      *actor `json:"author"`
}

type projectItem struct {
	Project struct {
		Title  string `json:"title"`
		Number int    `json:"number"`
	} `json:"project"`
	FieldValueByName *struct {
		Typename  string `json:"__typename"`
		Name      string `json:"name"`
		UpdatedAt string `json:"updatedAt"`
	} `json:"fieldValueByName"`
}

func runSearch(
	ctx context.Context,
	c ghClient,
	query string,
	statusField string,
) ([]searchNode, error) {
	var out []searchNode

	cursor := ""
	for {
		vars := map[string]any{"q": query, "statusField": statusField}
		if cursor != "" {
			vars["cursor"] = cursor
		} else {
			vars["cursor"] = nil
		}

		var resp searchResponse
		if err := c.GraphQL(ctx, searchQuery, vars, &resp); err != nil {
			return nil, fmt.Errorf("issuing search graphql request: %w", err)
		}

		out = append(out, resp.Search.Nodes...)
		if !resp.Search.PageInfo.HasNextPage {
			break
		}

		cursor = resp.Search.PageInfo.EndCursor
	}

	return out, nil
}

func categorise(nodes []searchNode, p Params) *Report {
	r := &Report{
		InProgress:     nil,
		ReadyForReview: nil,
		Blocked:        nil,
		ClosedOrMerged: nil,
		Uncategorized:  nil,
	}
	for _, n := range nodes {
		switch n.Typename {
		case "PullRequest":
			classifyPR(n, p, r)
		case "Issue":
			classifyIssue(n, p, r)
		}
	}

	return r
}

func classifyPR(n searchNode, p Params, r *Report) {
	item := Item{
		Kind:       KindPR,
		Number:     n.Number,
		Title:      n.Title,
		URL:        n.URL,
		Repository: n.Repository.NameWithOwner,
	}

	isAuthor := n.Author != nil && strings.EqualFold(n.Author.Login, p.User)

	// 1. Closed or merged in window.
	if inWindow(n.MergedAt, p) || inWindow(n.ClosedAt, p) {
		r.ClosedOrMerged = append(r.ClosedOrMerged, item)
		return
	}

	// 2. Project status set to "Waiting" in window.
	if isAuthor && hasStatusInWindow(n.ProjectItems.Nodes, p.WaitingStatus, p) {
		r.Blocked = append(r.Blocked, item)
		return
	}

	// 3. Project status set to "Ready for review" in window,
	// or PullRequest converted from draft to ready in window.
	if isAuthor && (hasStatusInWindow(n.ProjectItems.Nodes, p.ReadyStatus, p) ||
		hasReadyForReviewEvent(n.TimelineItems.Nodes, p)) {
		r.ReadyForReview = append(r.ReadyForReview, item)
		return
	}

	// 4. In progress: authored by user, opened or pushed-to in window.
	if isAuthor && (inWindow(n.CreatedAt, p) || hasUserCommitInWindow(n, p)) {
		r.InProgress = append(r.InProgress, item)
		return
	}

	// 5. Uncategorized: any other in-window PR activity by the user (reviews
	// or comments). The search uses `updated:Since..Until`, which matches
	// third-party updates too, so we require an actual user signal — being
	// non-authored is not enough on its own.
	if hasUserTimelineActivity(n.TimelineItems.Nodes, p) {
		r.Uncategorized = append(r.Uncategorized, item)
	}
}

func classifyIssue(n searchNode, p Params, r *Report) {
	item := Item{
		Kind:       KindIssue,
		Number:     n.Number,
		Title:      n.Title,
		URL:        n.URL,
		Repository: n.Repository.NameWithOwner,
	}

	isAuthor := n.Author != nil && strings.EqualFold(n.Author.Login, p.User)

	if (isAuthor && inWindow(n.CreatedAt, p)) ||
		hasUserTimelineActivity(n.TimelineItems.Nodes, p) {
		r.Uncategorized = append(r.Uncategorized, item)
	}
}

func hasReadyForReviewEvent(items []timelineItem, p Params) bool {
	for _, it := range items {
		if it.Typename == "ReadyForReviewEvent" && inWindow(it.CreatedAt, p) {
			return true
		}
	}

	return false
}

func hasUserCommitInWindow(n searchNode, p Params) bool {
	for _, c := range n.Commits.Nodes {
		if !inWindow(c.Commit.CommittedDate, p) {
			continue
		}

		if c.Commit.Author.User != nil &&
			strings.EqualFold(c.Commit.Author.User.Login, p.User) {
			return true
		}
	}

	return false
}

func hasUserTimelineActivity(items []timelineItem, p Params) bool {
	for _, it := range items {
		var (
			ts  string
			who *actor
		)

		switch it.Typename {
		case "PullRequestReview":
			ts, who = it.SubmittedAt, it.Author
		case "IssueComment":
			ts, who = it.CreatedAt, it.Author
		default:
			continue
		}

		if who == nil || !strings.EqualFold(who.Login, p.User) {
			continue
		}

		if inWindow(ts, p) {
			return true
		}
	}

	return false
}

func hasStatusInWindow(items []projectItem, target string, p Params) bool {
	if target == "" {
		return false
	}

	for _, pi := range items {
		if pi.FieldValueByName == nil {
			continue
		}

		if !strings.EqualFold(pi.FieldValueByName.Name, target) {
			continue
		}

		if inWindow(pi.FieldValueByName.UpdatedAt, p) {
			return true
		}
	}

	return false
}

func inWindow(ts string, p Params) bool {
	if ts == "" {
		return false
	}

	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return false
	}

	if t.Before(p.Since) || t.After(p.Until) {
		return false
	}

	return true
}
