---
'@nhost/core': patch
---

Improve reliability of the token refresher
The token refresher had an unreliable behaviour, leading to too many refreshes, or refreshes that are missed, leading to an expired access token (JWT).

The internal refresher rules have been made more explicit in the code. Every second, this runs:

- If the client defined a `refreshIntervalTime` and the interval between when the last access token has been created and now is more than this value, then it triggers a refresh
- If the access token expires in less than five minutes, then it triggers a refresh

If a refresh fails, then it switches to a specific rule: it will make an attempt to refresh the token every five seconds
