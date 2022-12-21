---
'hasura-auth': patch
---

Allow WorkOS organization/domain/connection from the query parameters

The Grant `dynamic` parameter was not correctly set. Moreover, the Oauth routes were using `express.use` instead of `express.all`. As a result. the routes defined for `${OAUTH_ROUTE}/:provider` where also matching an url like `${OAUTH_ROUTE}/:provider/callback`, although they shouldn't have.
