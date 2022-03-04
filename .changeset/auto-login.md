---
'@nhost/client': minor
---

Improvements on `autoSignIn`

Auto login enables authentication from a link sent by email.
It parses the url query parameters of the browser and looks for a possible refresh token to consume and authenticate.
Although the mechanism existed already, it now broadcasts the refresh token to other tabs in the same browser, so they can also authenticate automatically.
