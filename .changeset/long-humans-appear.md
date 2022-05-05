---
'@nhost/hasura-auth-js': patch
'@nhost/nhost-js': patch
---

Don't take previous errors into account when using SMS and deanonymisation
When using the SMS and anonymous signing methods of the Nhost client, the action failed with the client's previous error.
