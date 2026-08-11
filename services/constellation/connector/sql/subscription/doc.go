// Package subscription provides SQL-specific subscription handling using
// cohort-based multiplexing for efficient batching of similar subscriptions.
//
// # Architecture Overview
//
// The package implements the subscription.Handler interface from the subscription
// package, providing optimized subscription execution for SQL databases.
//
//	┌─────────────────────────────────────────────────────────────────────────┐
//	│                               Handler                                    │
//	│  - Implements subscription.Handler interface                            │
//	│  - Routes Start/Stop/Shutdown to cohortManager                          │
//	└─────────────────────────────────────────────────────────────────────────┘
//	                                    │
//	                                    ▼
//	┌─────────────────────────────────────────────────────────────────────────┐
//	│                           cohortManager                                  │
//	│  - Groups subscriptions by query template + role                        │
//	│  - Manages one polling goroutine per cohort                             │
//	│  - Executes multiplexed queries for batched results                     │
//	│  - Sends updates to subscription channels                               │
//	└─────────────────────────────────────────────────────────────────────────┘
//	                                    │
//	                                    ▼
//	┌─────────────────────────────────────────────────────────────────────────┐
//	│                               cohort                                     │
//	│  - Groups subscriptions with same query + role                          │
//	│  - Maximum 100 subscriptions per cohort                                 │
//	│  - Overflow creates new cohorts with suffix                             │
//	└─────────────────────────────────────────────────────────────────────────┘
//	                                    │
//	                                    ▼
//	┌─────────────────────────────────────────────────────────────────────────┐
//	│                         cohortSubscription                               │
//	│  - Tracks individual subscription state                                 │
//	│  - Stores session and GraphQL variables                                 │
//	│  - Owns update channel for sending results                              │
//	│  - Tracks last hash for change detection                                │
//	└─────────────────────────────────────────────────────────────────────────┘
//
// # Multiplexed Query Execution
//
// When multiple subscriptions share the same query template and role, they can
// be executed as a single database query using Hasura-style UNNEST + JSON:
//
//	SELECT "_subs"."result_id", "_fld_resp"."root" AS "result"
//	FROM UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars")
//	LEFT OUTER JOIN LATERAL (
//	    SELECT (... inner query with session vars from _subs.result_vars ...)
//	) AS "_fld_resp" ON ('true')
//
// Each subscription's session variables are packed into a JSON object in the
// result_vars array. The inner query extracts these using JSON path expressions:
//
//	("_subs"."result_vars" #>> '{session,x-hasura-user-id}')::uuid
//
// # Change Detection
//
// To avoid sending duplicate data, each subscription tracks an xxhash of the
// last result. Before sending an update, the manager compares the new hash to
// the stored hash. Only if they differ is the update sent.
//
// # Dependency on the queries package
//
// The QueryBuilder and QueryExecutor interfaces are the seam this package
// uses for unit testing via mockgen. They are not a portability boundary:
// the package deliberately imports queries/core and queries/multiplexed
// directly to reach core.SQLOperation, core.StreamCursorInfo, and
// multiplexed.ExtractInitialCursorValues. The coupling is intentional
// because (1) core.SQLOperation is already the value type carried across
// the QueryBuilder and QueryExecutor signatures, so core sits on the seam
// rather than behind it, and (2) queries, queries/core, queries/multiplexed,
// and this package are siblings inside connector/sql/ that ship together —
// no alternate QueryBuilder implementation is expected. Hiding the cursor
// helpers behind extra interface methods has been tried and reverted as
// pure churn; if the rule against direct cross-package access is reapplied
// here, prefer documenting the coupling over re-introducing the indirection.
//
// # Usage
//
//	connector := sql.NewConnector(...)
//	handler := subscription.NewHandler(connector, roots, schemas, time.Second, logger)
//
//	// handler implements subscription.Handler
//	updateCh, err := handler.Start(ctx, subscription.Request{
//	    ID:               "sub-1",
//	    Query:            "subscription { users { id name } }",
//	    Role:             "user",
//	    SessionVariables: map[string]any{"x-hasura-user-id": "123"},
//	})
//
//	for update := range updateCh {
//	    // Process update.Data or update.Error
//	}
//
//	handler.Stop(ctx, "sub-1")
package subscription
