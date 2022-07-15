---
"@nhost/core": patch
"@nhost/nextjs": patch
---

- Using same cookie package ([`js-cookie`](https://www.npmjs.com/package/js-cookie)) for both `@nhost/nextjs` and `@nhost/core` packages.
- Adding `expires` to avoid the cookie turning into a session cookie that some browsers aggressively destroy.
