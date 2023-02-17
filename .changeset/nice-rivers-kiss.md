---
'hasura-auth': minor
---

Revert #317 (connect directly to postgres)

We are reverting #317 because of issues we found with connections being exhausted on the database side. Having hasura-auth connect directly means that we have to consider/tweak an additional connection pooler. It also makes things a bit more cumbersome, operationally speaking, when provisioning projects in the cloud.

The initial goal of #317 was to allow users to choose the naming convention to use with hasura. We have found that using hasura's run_sql, available through its schema API (https://hasura.io/docs/latest/api-reference/schema-api/run-sql/#schema-run-sql), allows for the same naming flexibility while funneling all connections through the same entry point.
