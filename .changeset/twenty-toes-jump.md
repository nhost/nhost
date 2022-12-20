---
'@nhost/nextjs': patch
'@nhost/nhost-js': patch
---

Use initial session sent from the server

When running a SSR page, the session was correctly created from the refresh token on the server side and was sent to the client side, but was not used correctly on the client side.
As a result, the client was refreshing the access token when loading the page, rather than using the access token sent by the server.
The client now uses the session sent from the server.
