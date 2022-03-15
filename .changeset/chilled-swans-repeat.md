---
"@nhost/hasura-auth-js": patch
---

fix: current options when sign in with a provider
We currently only support setting the redirectTo option for providers.
This patch removes the options that do not work and adds the redirectTo option correctly to the provider sign-in URL.

