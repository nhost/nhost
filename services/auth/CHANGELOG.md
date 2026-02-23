## [auth@0.47.0] - 2026-02-23

### 🚀 Features

- *(auth)* Added graphql scope support to oauth2's userinfo endpoint (#3942)

## [auth@0.46.0] - 2026-02-19

### 🚀 Features

- *(nixops)* Update nixpkgs (#3808)
- *(auth)* Added oauth2/oidc provider functionality (#3922)


### 🐛 Bug Fixes

- *(nixops)* Bump go to 1.26.0 (#3907)

## [auth@0.45.0] - 2026-01-13

### 🚀 Features

- *(auth)* Change locale so it allows for 3 characters (#3776)

## [auth@0.44.2] - 2025-12-18

### 🐛 Bug Fixes

- *(auth)* Add back support for workos connection/organization on signin (#3731)

## [auth@0.44.1] - 2025-12-05

### 🐛 Bug Fixes

- *(auth)* Apply middleware in the correct order (#3741)

## [auth@0.44.0] - 2025-12-04

### 🚀 Features

- *(auth)* Expand turnstile to passwordess and email reset (#3736)

## [auth@0.43.2] - 2025-11-27

### 🐛 Bug Fixes

- *(auth)* Automatic probabilistic cleanup of expired refresh tokens (#3722)

## [auth@0.43.1] - 2025-11-11

### 🐛 Bug Fixes

- *(auth)* Return meaningful error if the provider's account is already linked (#3680)

## [auth@0.43.0] - 2025-11-04

### 🚀 Features

- *(auth)* Encrypt TOTP secret (#3619)
- *(auth)* Added endpoints to retrieve and refresh oauth2 providers' tokens (#3614)
- *(auth)* If the callback state is wrong send back to the redirectTo as provider_state (#3649)
- *(internal/lib)* Common oapi middleware for go services (#3663)


### 🐛 Bug Fixes

- *(auth)* Dont mutate client URL (#3660)


### ⚙️ Miscellaneous Tasks

- *(docs)* Fix broken link in openapi spec and minor mistakes in postmark integration info (#3621)
- *(nixops)* Bump go to 1.25.3 and nixpkgs due to CVEs (#3652)

# Changelog

All notable changes to this project will be documented in this file.

## [auth@0.42.4] - 2025-10-20

### 🐛 Bug Fixes

- *(auth)* Apply relationships on new projects (#3617)

## [auth@0.42.3] - 2025-10-20

### 🐛 Bug Fixes

- *(auth)* Always apply expected metadata (#3616)


### ⚙️ Miscellaneous Tasks

- *(storage)* Migrate to urfave and slog libraries (#3606)

## [auth@0.42.2] - 2025-10-13

### ⚙️ Miscellaneous Tasks

- *(docs)* Udpated README.md and CONTRIBUTING.md (#3587)
- *(auth)* Add wget to docker image (#3601)


For previous versions, please see the [old releases page](https://github.com/nhost/hasura-auth/releases).
