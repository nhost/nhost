---
'hasura-auth': patch
---

A custom claim that is expected to be an array (ie. contains "[]" in its path) will be set to an empty array - instead of being undefined - when its query returns no value.

This allows permissions of the form "something IN X-Hasura-myCustomClaimArray" to work as intended
when the array is empty.
