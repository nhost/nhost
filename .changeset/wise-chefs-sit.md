---
'@nhost/nextjs': minor
'@nhost/react-apollo': minor
---

Use `@nhost/react` as a peer dependency
`@nhost/react` was bundled where it shouldn't. As a result, `@nhost/react-apollo` did not have access to the Nhost React context, leading to errors
