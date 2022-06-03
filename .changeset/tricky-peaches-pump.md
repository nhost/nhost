---
'@nhost/core': patch
'@nhost/react': patch
'@nhost/nextjs': patch
---

correct rewriting options when `clientUrl` is not available
The client URL is set to `window.location.origin`, so it can rewrite redirection urls that are passed on to authenticaion methods. However, `clientUrl` is set to `''` when running on the server side. This fix then avoid raising an error when trying to rewrite `redirectTo` on non-browser environment, and forces `useProviderLink` to be rendered on the client side.
