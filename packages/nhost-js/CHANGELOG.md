## [@nhost/nhost-js@4.4.0] - 2026-02-06

### 🚀 Features

- *(ci)* Remove mintlify (#3887)


### 🐛 Bug Fixes

- *(nixops)* Update nodejs to v24 (#3862)
- *(deps)* Update brace-expansion due to cve (#3886)
- *(nhost-js)* Decode base64url-encoded strings correctly in jwt tokens (#3892)

## [@nhost/nhost-js@4.3.0] - 2026-02-02

### 🚀 Features

- *(auth)* Change locale so it allows for 3 characters (#3776)
- *(nixops)* Update nixpkgs (#3808)
- *(nixops)* Package mintlify (#3822)


### 🐛 Bug Fixes

- *(dashboard)* Migrate to biome from prettier in the dashboard (#3788)
- *(examples)* Update svelte and devalue (#3817)
- *(deps)* Added pnpm overrides due to cves (#3831)
- *(deps)* Update nextjs due to vulnerability (#3854)


### ⚙️ Miscellaneous Tasks

- *(nhost-js)* Biome migration follow up (#3812)


### Chore

- *(deps)* Update tar due to cve (#3867)

## [@nhost/nhost-js@4.2.2] - 2026-01-13

### 🐛 Bug Fixes

- *(nhost-js)* Resolve CJS/ESM interop issues for Vite projects (#3784)


### Chore

- *(deps)* Update tar and qs packages (#3786)
- *(deps)* Update react-router (#3790)

## [@nhost/nhost-js@4.2.1] - 2025-12-18

### 🐛 Bug Fixes

- *(auth)* Add back support for workos connection/organization on signin (#3731)


### ⚙️ Miscellaneous Tasks

- *(ci)* Update npm/pnpm and remove deployment token (#3767)

## [@nhost/nhost-js@4.2.0] - 2025-11-27

### 🚀 Features

- *(storage)* Added support for images/heic (#3694)


### 🐛 Bug Fixes

- *(auth)* Return meaningful error if the provider's account is already linked (#3680)
- *(packages/nhost-js)* React native needs special treatment when using FormData (#3697)

## [@nhost/nhost-js@4.1.0] - 2025-11-04

### 🚀 Features

- *(nhost-js)* Added pushChainFunction to functions and graphql clients (#3610)
- *(nhost-js)* Added various middlewares to work with headers and customizable createNhostClient (#3612)
- *(auth)* Added endpoints to retrieve and refresh oauth2 providers' tokens (#3614)


### 🐛 Bug Fixes

- *(dashboard)* Run audit and lint in dashboard (#3578)
- *(nhost-js)* Improvements to Session guard to avoid conflict with ProviderSession (#3662)


### ⚙️ Miscellaneous Tasks

- *(nhost-js)* Generate code from local API definitions (#3583)
- *(docs)* Udpated README.md and CONTRIBUTING.md (#3587)
- *(nhost-js)* Regenerate types (#3648)

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
