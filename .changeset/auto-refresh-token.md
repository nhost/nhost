---
'@nhost/client': minor
---

Improvements on `autoRefreshToken`

Auto refresh now uses a client-side timestamp from the instant of its creation to the access token expiration interval. As a result, there is less change of refresh and access token becoming stale or out of sync.
