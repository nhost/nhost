---
'hasura-auth': patch
---

Enforce Oauth scopes required by hasura-auth
Custom scopes set as environment variables don't replace the scopes that are required by Hasura-auth to function. They are appended instead.
