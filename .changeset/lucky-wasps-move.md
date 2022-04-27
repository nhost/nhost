---
'@nhost/nextjs': minor
---

Introduce `createServerSideNhostClient`
Until now, the Nhost client was not functionning correctly on the server side.
The `createServerSideNhostClient` can be called inside the `getServerSideProps` function of a page.
When called, it will try to get the refesh token in cookies, or from the request URL.
If a refresh token is found, it uses it to get an up to date access token (JWT) and a user session
This method returns a promise of an `NhostClient` and resolves only when the authentication status is known eventually.

`getNhostSession` now uses the above method under the hood to extract the user session and hydrate the NhostClient context on the client side.
