# Changelog

All notable changes to this project will be documented in this file.

## [@nhost/nhost-js@4.0.1] - 2025-09-24

### ⚙️ Miscellaneous Tasks

- *(docs)* Update README (#3492)

- fix (packages/nhost-js): force refresh correctly if marginSeconds is set to 0 #54

# 5.0.0-beta.9

- fix (packages/nhost-js): if session doesn't have decodedToken treat as expired #49

# 5.0.0-beta.8

- feat (package/nhost-js): update openapi specs and properly generate formData when uploading/updating files #47
- chore (nhost-js): update openapi #44
- feat (packages/nhost-js): added functions.post method and improve documentation #43
- feat (packages/nhost-js): add decoded token to session storage #37
- feat (packages/nhost-js): graphql.post -> graphql.request #41

# 5.0.0-beta.7

- fix (packages/nhost-js): extract query name from TypedDocumentNode #36

# 5.0.0-beta.6

- fix (packages/nhost-js): added missing endpoints (storage) and baseURL (functions) #35

# 5.0.0-beta.5

- fix (packages/nhost-js): improve some function names, webauthn types and added elevate endpoints #32
- feat (packages/nhost-js): graphl client's post now supports TypedDocumentNode #31
- fix (tools/codegen;packages/nhost-js): encode URL parameters better #30
- fix (packages/next-js): use proper types for Webauthn endpoints #29
- chore (ci): enabled #26
