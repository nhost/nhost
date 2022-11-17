---
'hasura-auth': minor
---

Use [Grant](https://github.com/simov/grant)
Hasura Auth was relying on PassportJS and numerous npm packages to orchestrate each Oauth provider. The code became complex to maintain, and it became more and more difficult to add new providers.
Providers are noew defined in one single file so it is easier to add new ones.
