---
'hasura-auth': patch
---

Preserve the case in `redirectTo` options, and case-insensitive validation
The `redirectTo` values were transformed into lower case. It now validates regardless of the case, and preserve the original value.
