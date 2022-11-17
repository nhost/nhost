---
'hasura-auth': patch
---

Redirect Oauth errors or cancellations
When a user cancelled their authentication in the middle of the Oauth choregraphy, they were falling back to an error on the Hasura Auth callback endpoint.
Hasura Auth now parses the error and redirect the user to the client url, with error details as query parameters.
