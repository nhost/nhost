## Changelog

## 0.24.0

### Minor Changes

- 634f2bf: feat: add `AUTH_WEBAUTHN_RP_ID` environment variable

### Patch Changes

- 2e3096c: fix: conceal error if AUTH_CONCEAL_ERRORS is set

## 0.23.0

### Minor Changes

- cd8c786: feat: add option to disable user sign-up through `AUTH_DISABLE_SIGNUP`

### Patch Changes

- 003cfd6: fix: make sure existing modified permissions are not overwritten
- 15459a9: fix: use empty as AUTH_API_PREFIX default value
- ffba7d8: fix: move catch-all route-not-found handler to root

## 0.22.1

### Patch Changes

- b727ab9: fix: update sign-in with Linked-In to use OpenId

## 0.22.0

### Minor Changes

- 024258c: feat: set oauth origin dynamically based on host header
- 5663eec: feat: allow configuring api prefix

### Patch Changes

- 044ed00: fix: mount oauth and healthz routes correctly when specifying AUTH_API_PREFIX

## 0.21.4

### Patch Changes

- 2aa0d6d: fix(oauth): correctly parse user profile during Sign-In with Apple
- 59e588a: added codeql

## 0.21.3

### Patch Changes

- 4eff7f4: fix: send back refresh token upon sign-in with pat

## 0.21.2

### Patch Changes

- ca5010d: fix: merge new select/delete permissions with the existing ones

## 0.21.1

### Patch Changes

- 840d730: feat(smtp): make the `X-SMTPAPI` header configurable

## 0.21.0

### Minor Changes

- ceaca45: chore(node): bump Node.js to v18

### Patch Changes

- 1706c37: fix(redirect): generate valid redirection links
- ceaca45: chore(logs): improve logging in production
- 60dcbf4: fix(email-templates): correct typos in the French translation

## 0.20.2

### Patch Changes

- 0cc9d36: fix: don't crash when adding allowed roles upon sign-in with a provider

## 0.20.1

### Patch Changes

- d412a93: feat: add `refreshTokenId` to session

## 0.20.0

### Minor Changes

- 50a1b1d: chore: migrate `refresh_token` column to `id`

  ⚠️ **Warning**: This is a breaking change.

  We've renamed the `refresh_token` column to `id`. While this change will improve the functionality of Hasura Auth, it may cause issues for any permissions or relationships that were using the old `refresh_token` column.

  Please note that any permissions or relationships that were using the `refresh_token` column will be affected by this change. If you're using the `refresh_token` column in any way, you'll need to update your code to use the new `id` column and ensure that your app works as expected.

## 0.19.3

### Patch Changes

- 29eff81: fix(oauth): be more verbose when a provider fails
- 5529f7d: fix(pat): replace enum type with an enum table to fix issues with PAT creation
- 005e259: chore(logs): add `AUTH_SHOW_LOG_QUERY_PARAMS` environment variable to control query parameter visibility

## 0.19.2

### Patch Changes

- 9a7e027: chore(logs): add masked headers and query parameters to logs
- 11e1eb3: feat(pat): allow users to create personal access tokens

## 0.19.1

### Patch Changes

- 73b7642: Introduce support for using wildcards with redirect URLs

## 0.19.0

### Minor Changes

- f7ec32f: Revert #317 (connect directly to postgres)

  We are reverting #317 because of issues we found with connections being exhausted on the database side. Having hasura-auth connect directly means that we have to consider/tweak an additional connection pooler. It also makes things a bit more cumbersome, operationally speaking, when provisioning projects in the cloud.

  The initial goal of #317 was to allow users to choose the naming convention to use with hasura. We have found that using hasura's run_sql, available through its schema API (https://hasura.io/docs/latest/api-reference/schema-api/run-sql/#schema-run-sql), allows for the same naming flexibility while funneling all connections through the same entry point.

### Patch Changes

- 2eadfa9: Fix validation for redirectUrl

## 0.18.0

### Minor Changes

- 45afb45: Stop sending the refresh token in the hash part of the redirection

  Originally, hasura-auth was adding the refresh token to the hash part of the redirection urls, but [we decided to add it to the query parameters](https://github.com/nhost/hasura-auth/pull/146), as the hash was not accessible in SSR pages.
  We decided to add the refresh token in both places during a transition period in order to prevent a breaking change with legacy versions of the SDK, that were looking for the refresh token in the hash.
  However, since `@nhost/nhostjs@1.1.4` (April), the SDK also finds (and removes) the refresh token in both places.

  Sending the refresh in the hash has a significant impact on Vue users, as the vue-router is handling routes in the hash part of the url in its own way that conflicts with the urls sent by hasura-auth.

  This is a breaking change for clients using previous versions of the SDK, or manually looking for the refresh token in the hash instead of the query parameter

- d5eed8f: Use SQL instead of GraphQL to interact with the DB

  Run DB operations through SQL rather than GraphQL, so the user can pick any [Hasura naming convention configuration](https://hasura.io/docs/latest/schema/postgres/naming-convention/) they want.

  As the SQL operations are simpler than the ones generated by Hasura, and as we don't use Hasura anymore to proxy DB operations, it also comes with a slight performance increase.

  Hasura-auth now only uses the GraphQL API to generate custom claims.

- 2e15427: Introduce a new `refresh_tokens.refresh_token_hash` column.

  Preparatory work to store refresh tokens as a SHA256 hash.

  To avoid a breaking change, the `refresh_tokens.refresh_token` column remains unchanged until the next major release.

  - The `refresh_tokens.refresh_token` column is now deprecated.
  - The hashed refresh token is a Postgres stored generated column.
  - The internal GraphQL queries are using the hashed refresh token.
  - The internal GraphQL mutations are still updating the `refresh_token` column.

  When introducing the breaking change, we will:

  - Rename `refresh_tokens.refresh_token` to `refresh_tokens.id`.
  - Use the `id` column as an identifier.
  - Remove the `generated` expression in the `refresh_token_hash` column.
  - New refresh tokens will then be saved uniquely as SHA256.

### Patch Changes

- de0b163: Added spanish email templates, thanks [@JepriCreations](https://github.com/JepriCreations) for the contribution
- b398ae2: A custom claim that is expected to be an array (ie. contains "[]" in its path) will be set to an empty array - instead of being undefined - when its query returns no value.

  This allows permissions of the form "something IN X-Hasura-myCustomClaimArray" to work as intended
  when the array is empty.

- 87a3e96: Added czech email templates, thanks [@suplere](https://github.com/suplere) for the contribution
- fff9d1f: Added bulgarian email templates, thanks [@azlekov](https://github.com/azlekov) for the contribution
- 5a224e6: Improve the logging of the SMTP errors

  When an email could not be sent, the logs where too limited. As a result, it was not possible to know the reason why emails could not be sent, nor knowing why hasura-auth was returning an HTTP 500 error.

  When an email can't be sent, hasura-auth now adds two more lines to the logs before the standard http log row:

  ```json
  {"address":"127.0.0.1","code":"ESOCKET","command":"CONN","errno":-61,"level":"warn","message":"SMTP error","port":1026,"syscall":"connect"}
  {"level":"warn","message":"SMTP error context","template":"email-verify","to":"bob@sponge.com"}
  {"latencyInNs":271000000,"level":"error","message":"POST /signup/email-password 500 271ms","method":"POST","statusCode":500,"url":"/signup/email-password"}
  ```

## 0.17.1

### Patch Changes

- f85e92d: - The default role is now automatically added to the allowed roles.

  - The default locale is now automatically added to the allowed locales.

  Previously, it was explicitly required to add the `me` and `AUTH_USER_DEFAULT_ROLE` roles to `AUTH_USER_DEFAULT_ALLOWED_ROLES`. They are now automatically added to `AUTH_USER_DEFAULT_ALLOWED_ROLES`.

  Before:

  ```
  AUTH_USER_DEFAULT_ROLE=user
  AUTH_USER_DEFAULT_ALLOWED_ROLES=user,me,other
  ```

  Now, the following configuration will also work:

  ```
  AUTH_USER_DEFAULT_ROLE=user
  AUTH_USER_DEFAULT_ALLOWED_ROLES=other
  ```

  Both syntaxes will allow the roles `user`, `me`, and `other`.

  Similarly, it is no longer a requirement to add the value of `AUTH_LOCALE_DEFAULT` to the `AUTH_LOCALE_ALLOWED_LOCALES`.

  Before:

  ```
  AUTH_LOCALE_DEFAULT=en
  AUTH_LOCALE_ALLOWED_LOCALES=en,fr
  ```

  Now, the following configuration will also work:

  ```
  AUTH_LOCALE_DEFAULT=en
  AUTH_LOCALE_ALLOWED_LOCALES=en,fr
  ```

  Both syntaxes will allow the locales `en` and `fr`.

- 02da92a: Allow WorkOS organization/domain/connection from the query parameters

  The Grant `dynamic` parameter was not correctly set. Moreover, the Oauth routes were using `express.use` instead of `express.all`. As a result. the routes defined for `${OAUTH_ROUTE}/:provider` where also matching an url like `${OAUTH_ROUTE}/:provider/callback`, although they shouldn't have.

## 0.17.0

### Minor Changes

- 951349b: Optionally conceal sensitive error messages

  Introduce a new `AUTH_CONCEAL_ERRORS` environment variable that conceals error messages to avoid leaking indirect information about users e.g. a user is registered in the application or a given password is invalid.

  It is disabled by default.

### Patch Changes

- d3fe853: Preserve the Oauth session between the initial request and the callback

  Fixes [nhost/nhost#1353](https://github.com/nhost/nhost/issues/1353)

- 9c25b1f: Ability to set test phone numbers for phone auth

  This can be used without any provider set. When sign in via phone auth using a test phone number is invoked **the SMS message with the verification code will be available trough the logs**.
  This way you can also test your SMS templates.

## 0.16.2

### Patch Changes

- e0949d7: Try the first characters of the Oauth user profile's locale

  Some Oauth providers returns locales. But it can be `en-GB` whereas hasura-auth only accepts locales coded in two characters.
  It now tries to validate the two first characters of the user profile locale against the list of allowed locales.

- e0949d7: Don't fail WorkOS transformation when the user profile is incorrect

  When not configuring WorkOS correctly, the `raw_attributes` of the user profile could be null. This fix avoids returning an error when accessing properties of this object that would be null.

- e0949d7: Correct validation of custom locale and redirect urls in Oauth routes

## 0.16.1

### Patch Changes

- 42d7ce8: Fix Oauth redirection

## 0.16.0

### Minor Changes

- 09478c4: Allow patterns in allowed urls

  `AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS` now accepts wildcard and other [micromatch patterns](https://github.com/micromatch/micromatch#matching-features) in `AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS`.

  To match `https://(random-subdomain).vercel.app`:

  ```
  AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=https://*.vercel.app
  ```

  As a result:

  ```sh
  # Correct
  https://bob.vercel.app
  https://anything.vercel.app

  # Incorrect
  https://sub.bob.vercel.app
  http://bob.vercel.app
  https://vercel.app

  ```

  It is possible to use other patterns, for instance:

  - to allow both http and https:

  ```
  AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=http?(s)://website.com
  ```

  - to allow any port:

  ```
  AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS=http://website.com?(:{1..65536})
  ```

- 4d16514: Fix Twitter provider (close [#100](https://github.com/nhost/hasura-auth/issues/100))
- c6daab9: Synchronise `AUTH_USER_DEFAULT_ALLOWED_ROLES` and `AUTH_USER_DEFAULT_ROLE` with the database
  When starting the server, all the roles defined in `AUTH_USER_DEFAULT_ALLOWED_ROLES` and `AUTH_USER_DEFAULT_ROLE` are upserted into the `auth.roles`
  table
- 4d16514: Use [Grant](https://github.com/simov/grant)
  Hasura Auth was relying on PassportJS and numerous npm packages to orchestrate each Oauth provider. The code became complex to maintain, and it became more and more difficult to add new providers.
  Providers are noew defined in one single file so it is easier to add new ones.

### Patch Changes

- 4d16514: Fetch the user locale when available (Discord, Google, LinkedIn, WorkOS)
- 4d16514: Fetch avatar url from BitBucket
- 4d16514: Fetch display name from the Strava provider
- c6daab9: Redirect Oauth errors or cancellations
  When a user cancelled their authentication in the middle of the Oauth choregraphy, they were falling back to an error on the Hasura Auth callback endpoint.
  Hasura Auth now parses the error and redirect the user to the client url, with error details as query parameters.
- 4d16514: The service starts when a provider is incorrectly configured. Instead, the endpoint fails with a standard error. The error is logged (warn level)
- 4d16514: Fetch the email verification status when available (Apple, BitBucket, Discord, GitHub, Google)
- c6daab9: Preserve the case in `redirectTo` options, and case-insensitive validation
  The `redirectTo` values were transformed into lower case. It now validates regardless of the case, and preserve the original value.
- c6daab9: Return Have I Been Pwned error message
  Hasura Auth now returns the reason why the password is not compliant with HIBP.
- c6daab9: Log error when failing to apply Hasura metadata
- c6daab9: Tell why Hasura can't be reached
  When starting, Hasura Auth waits for Hasura to be ready. Hasura Auth now logs the reason why Hasura can't be reached.
- 4d16514: Enforce Oauth scopes required by hasura-auth
  Custom scopes set as environment variables don't replace the scopes that are required by Hasura-auth to function. They are appended instead.
- c6daab9: Increase OTP secret entropy to 256 bits

## [0.15.0](https://github.com/nhost/hasura-auth/compare/v0.14.0...v0.15.0) (2022-10-18)

### Bug Fixes

- 🐛 capture unhandled errors ([c1f82c4](https://github.com/nhost/hasura-auth/commit/c1f82c45034aa396b9626a57afde89bd54b04564))
- 🐛 remove wrong email-template warning ([8972912](https://github.com/nhost/hasura-auth/commit/89729120343cef6e55a87483cb66a98dcd85e144)), closes [#168](https://github.com/nhost/hasura-auth/issues/168)
- use the metadata column in custom claims ([179d96a](https://github.com/nhost/hasura-auth/commit/179d96ad933b3fb849c13f38af8efd3cd02dfca9))

### Features

- 🎸 Improve logging ([4bccab8](https://github.com/nhost/hasura-auth/commit/4bccab8794978ee47f60689c1a01d2f5bde767cf))
- 🎸 improve metadata application and startup time ([728f35b](https://github.com/nhost/hasura-auth/commit/728f35bc6b8dea265aac22ddd3b583ec328ba917))# [0.14.0](https://github.com/nhost/hasura-auth/compare/v0.13.2...v0.14.0) (2022-10-07)

## 0.14.0

### Features

- **provider:** add azure ad provider ([c7247cc](https://github.com/nhost/hasura-auth/commit/c7247ccd0b1d0128a4b2e7af02c768cae175aa08))## [0.13.2](https://github.com/nhost/hasura-auth/compare/v0.13.1...v0.13.2) (2022-09-28), thanks [@yannickglt](https://github.com/yannickglt) for the contribution

## 0.13.2

### Bug Fixes

- drop authenticators inconsistency safely ([5939bd8](https://github.com/nhost/hasura-auth/commit/5939bd81c1943034801da11f3da06b163fc2f291))## [0.13.1](https://github.com/nhost/hasura-auth/compare/v0.13.0...v0.13.1) (2022-09-27)

## 0.13.1

### Bug Fixes

- don't drop inconsistencies when applying Hasura metadata ([3744152](https://github.com/nhost/hasura-auth/commit/374415289b83df84557b3822897082e38aff1cd6))# [0.13.0](https://github.com/nhost/hasura-auth/compare/v0.12.0...v0.13.0) (2022-09-23)

## 0.13.0

### Bug Fixes

- Rename `authenticators` to `security keys` in the DB and GraphQL schemas
- Fetch profile from WorkOS oauth connection ([b49d4f7](https://github.com/nhost/hasura-auth/commit/b49d4f70c7dd1cf560243b11e34f94ce7b688e05))
- Use client hostname as RP ID ([2371fdc](https://github.com/nhost/hasura-auth/commit/2371fdc9173ffa79b008c8581450c51ce1546d08))
- webauthn signup endpoints ([8982a49](https://github.com/nhost/hasura-auth/commit/8982a497df87fafa7c7cad3b52de8c1f9e2e134e))# [0.12.0](https://github.com/nhost/hasura-auth/compare/v0.11.0...v0.12.0) (2022-09-16)

## 0.12.0

### Bug Fixes

- 🐛 deprecate AUTH_EMAIL_TEMPLATE_FETCH_URL ([4067c03](https://github.com/nhost/hasura-auth/commit/4067c03385962cbde4b6c432a9d50880ebcbc26b))
- 🐛 don't add custom claims when null/undefined values ([7a129f6](https://github.com/nhost/hasura-auth/commit/7a129f6cf04b880b5cc4b4e7aebee1a44bca4af7))
- 🐛 don't break reditection with redirectTo and params ([3e55b9e](https://github.com/nhost/hasura-auth/commit/3e55b9e11cee221a04c4ce45167493aa1a37aeb7)), closes [#233](https://github.com/nhost/hasura-auth/issues/233)

### Features

- **sms:** support for templates for the sms message ([#217](https://github.com/nhost/hasura-auth/issues/217)) ([e99ec64](https://github.com/nhost/hasura-auth/commit/e99ec64bcaf4831bbc16e85ced86f8bc0166a999))# [0.11.0](https://github.com/nhost/hasura-auth/compare/v0.10.0...v0.11.0) (2022-09-08)

## 0.11.0

### Bug Fixes

- broaden WebAuthn authenticators & algorithms ([bdff4fe](https://github.com/nhost/hasura-auth/commit/bdff4fec245bcf264e4312c71b8992ba7b2e9195))
- send id+nickname when adding a security key ([f2cb098](https://github.com/nhost/hasura-auth/commit/f2cb098136c80b8b3c3fe46052a3102a7bc2660c))
- **webauthn:** use the hostname of `AUTH_SERVER_URL` as a default relying party ([7f3944d](https://github.com/nhost/hasura-auth/commit/7f3944d0ad027154856559b80c74fa08f3803136))
- **webauthn:** use the server url hostname as RP ([50126b4](https://github.com/nhost/hasura-auth/commit/50126b483aa292d40eb1467e0ba20203c6720539))

### Features

- remove webauthn signup endpoints ([224e990](https://github.com/nhost/hasura-auth/commit/224e9902b49fedffca3df198d4adea55112e0bba))
- **webauthn:** add optional authenticator nickname ([457fafd](https://github.com/nhost/hasura-auth/commit/457fafd6a0d6be8a7d84e1982b619487f083445a))
- workos oauth provider ([ab35971](https://github.com/nhost/hasura-auth/commit/ab359713a2346f1b6eebb8fdffa1de8cc4ec0a59))# [0.10.0](https://github.com/nhost/hasura-auth/compare/v0.9.3...v0.10.0) (2022-07-13)

## 0.10.0

### Bug Fixes

- Quote "OK" HTTP responses so auth endpoints can be used in Hasura Actions([5e7b6e0](https://github.com/nhost/hasura-auth/commit/5e7b6e0e144b682a755b9d2b108ac78857edc85e))
- Remove SQL comment on the `auth` schema as migration scripts should work even if the Postgres user does not own the `auth` ([6daeeee](https://github.com/nhost/hasura-auth/commit/6daeeee1efef619edcd074d5990a4cbf5a423402))
- **webauthn:** disable unauthorized add of subsequent authenticator ([077bd17](https://github.com/nhost/hasura-auth/commit/077bd1718227522b8db1dc05b63aed459e068784))

### Features

- Add FIDO2 Webauthn authentication ([2e18108](https://github.com/nhost/hasura-auth/commit/2e1810896112bd9e161f2178d223b33eaac8e584)), closes [#153](https://github.com/nhost/hasura-auth/issues/153)
- Change password with ticket ([3000223](https://github.com/nhost/hasura-auth/commit/30002238fa75723051b752ab019d775225011bf6))

## [0.9.3](https://github.com/nhost/hasura-auth/compare/v0.9.2...v0.9.3) (2022-06-30)

### Bug Fixes

- do not add null values to custom claims ([35bf186](https://github.com/nhost/hasura-auth/commit/35bf1863f3c23957d66afc679d41736a2eac47d5))
- use the metadata field in custom claims ([a7072d9](https://github.com/nhost/hasura-auth/commit/a7072d96c91be2bb38ec707ae96f5a0672a06c44))
- Fix the Apple Oauth provider: [#154](https://github.com/nhost/hasura-auth/issues/154)

### Documentation

- SQL comments on schema, tables, and colums ([aeea1d3](https://github.com/nhost/hasura-auth/commit/aeea1d335916aba04b3923bef09a05533167bed8))

## [0.9.2](https://github.com/nhost/hasura-auth/compare/v0.9.1...v0.9.2) (2022-06-22)

### Bug Fixes

- forbid anonymous users to change email or password, or to activate MFA ([064b15b](https://github.com/nhost/hasura-auth/commit/064b15be7da6eebb9f647d269e2c9cb9a6a795a6)

## [0.9.1](https://github.com/nhost/hasura-auth/compare/v0.9.0...v0.9.1) (2022-06-14)

### Bug Fixes

- add `displayName`, `email`, and `newEmail` variables to all email templates ([d2235e9](https://github.com/nhost/hasura-auth/commit/d2235e9f549efe2d9a345cf8a7a3d345fe8feb6e))
- do not actually follow redirection when redirectTo is invalid ([7d24e55](https://github.com/nhost/hasura-auth/commit/7d24e55d3a45207e2434cff39497984af6ae406c))
- workaround for outlook safelinks: add `HEAD` operation to the `/verify` route ([1f12a53](https://github.com/nhost/hasura-auth/commit/1f12a5351d7894c71a773052c9c7d4b8e64ac2d2)), closes [#189](https://github.com/nhost/hasura-auth/issues/189)

## [0.9.0](https://github.com/nhost/hasura-auth/compare/v0.8.1...v0.9.0) (2022-06-02)

### Bug Fixes

- validate phone number and transform them in the international format ([70edaca](https://github.com/nhost/hasura-auth/commit/70edaca1e4ef01197929c635f4f618b1a71c8598))

### Features

- allow any `redirectTo` when no `AUTH_CLIENT_URL` is set ([73c0262](https://github.com/nhost/hasura-auth/commit/73c02629bbcf8b935f1773598bbf413751148ba7))

### Bug Fixes

- Able to use both phone number and messaging service id as `from`
  This way users can use both a simple phone number without setting up a Twilio messaging service or use a messaging service from Twilio ([doc](https://support.twilio.com/hc/en-us/articles/223181308-Getting-started-with-Messaging-Services)).

## [0.8.0](https://github.com/nhost/hasura-auth/compare/v0.7.1...v0.8.0) (2022-05-24)

### Bug Fixes

- **token:** reuse and update expiration date of a valid refresh token instead of invalidating it and creating a new one ([7583997](https://github.com/nhost/hasura-auth/commit/7583997e45f323005a23f8b4b2aaa83ef27d3dea)), closes [#65](https://github.com/nhost/hasura-auth/issues/65)
- check locales are not more than two characters ([e2eac38](https://github.com/nhost/hasura-auth/commit/e2eac3897a6d666996d501aca9b73c73fd24be28))
- check the new email is not already in use before changing it ([0436574](https://github.com/nhost/hasura-auth/commit/043657441c009b3bc8ccf491f1d5aa2ad7fe55ab))
- return standard error codes in sms passwordless sign-in ([74087dd](https://github.com/nhost/hasura-auth/commit/74087dda41d6aa024e7f1097523d84f68bd1b247))
- Verify Twillio configuration before using it
- Don't delete the user if sending message with Twillio fails, closes [#79](https://github.com/nhost/hasura-auth/issues/79)
- Check user is active when authenticating with SMS passwordless, closes [#99](https://github.com/nhost/hasura-auth/issues/99)

### Features

- **token:** add verify token endpoint ([0a3457a](https://github.com/nhost/hasura-auth/commit/0a3457a1008f69491d74677dfc4b671de8afbb0a)), closes [#83](https://github.com/nhost/hasura-auth/issues/83)

### Reverts

- Revert "Return signIn responses for passwordless" ([363bbbc](https://github.com/nhost/hasura-auth/commit/363bbbceb30bf89a878fc1db984e8c9493ed4371))

## [0.7.1](https://github.com/nhost/hasura-auth/compare/v0.7.0...v0.7.1) (2022-04-28)

### Features

- use query parameter instead of hash when adding the refresh token to an url ([af8ea50](https://github.com/nhost/hasura-auth/commit/af8ea5097cf04d9991977c72bed0797218f5e997))

## [0.7.0](https://github.com/nhost/hasura-auth/compare/v0.6.3...v0.7.0) (2022-04-27)

### Bug Fixes

- don't fail when unknown options are present in the query parameters ([3bf88d8](https://github.com/nhost/hasura-auth/commit/3bf88d8a44a72700d033211a09996fd76b10c948))

### Features

- use encoded `redirectTo` url value in email templates ([9b88a91](https://github.com/nhost/hasura-auth/commit/9b88a91274aeb9eeeb3824eea79f444bcca47401))

## [0.6.3](https://github.com/nhost/hasura-auth/compare/v0.6.2...v0.6.3) (2022-04-21)

### Bug Fixes

- filter internal user fields in session ([d1c4c9b](https://github.com/nhost/hasura-auth/commit/d1c4c9bcb1b7901d989c6c0e194ebab617d5f579))

## [0.6.2](https://github.com/nhost/hasura-auth/compare/v0.6.1...v0.6.2) (2022-04-20)

### Bug Fixes

- revert 00002 migration name to previous name when migration fails because of it ([6a0856a](https://github.com/nhost/hasura-auth/commit/6a0856a9e6a18bf264579a783adae6c55efc4351))

## [0.6.1](https://github.com/nhost/hasura-auth/compare/v0.6.0...v0.6.1) (2022-04-20)

### Bug Fixes

- allow `redirectTo` option to start with any `AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS` value ([dac0332](https://github.com/nhost/hasura-auth/commit/dac0332a04f84c057f7013c65aac6223de8ab165))
- correct redirectTo and fall back to AUTH_CLIENT_URL if the `redirectTo` option is invalid ([2e1819d](https://github.com/nhost/hasura-auth/commit/2e1819d65a90c288b68c9e47a5dc131a7ab3355d)), closes [#137](https://github.com/nhost/hasura-auth/issues/137)
- remove the AUTH_HOST environment variable ([cacce97](https://github.com/nhost/hasura-auth/commit/cacce9757374af9bbf55b0360ad8c6b304004cd7)), closes [#139](https://github.com/nhost/hasura-auth/issues/139)
- run a metadata reload before and after applying hasura-auth metadata ([bd9b361](https://github.com/nhost/hasura-auth/commit/bd9b3618e916e97cea3d3fc8f013223cc0188b94))

### Performance Improvements

- improve logging on startup ([c172c8a](https://github.com/nhost/hasura-auth/commit/c172c8a55b527a99678c7826104cd0b57ae79f24))
- improve startup with async imports ([e00c073](https://github.com/nhost/hasura-auth/commit/e00c073d55c3d85fbd698e1e10c489b30d98949c))
- set AUTH_CLIENT_URL and AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS to lower case ([8bb351d](https://github.com/nhost/hasura-auth/commit/8bb351d55f0ebb15ac31d0c38265ddb8c2a22432))

## [0.6.0](https://github.com/nhost/hasura-auth/compare/v0.5.0...v0.6.0) (2022-04-06)

### Bug Fixes

- change default refresh token expiration to 30 days ([a2e0d2a](https://github.com/nhost/hasura-auth/commit/a2e0d2a677d0810534a2e2004b104e4e42cb4872)), closes [#48](https://github.com/nhost/hasura-auth/issues/48)
- rename JWT claim `x-hasura-isAnonymous` to `x-hasura-is-anonymous` ([a4ca42e](https://github.com/nhost/hasura-auth/commit/a4ca42e780a7b39464000e21b48df503fc3d50d9)), closes [#126](https://github.com/nhost/hasura-auth/issues/126)

### Features

- add `emailVerified`, `phoneNumber`, `phoneNumberVerified`, and `activeMfaType` to User ([4d452d7](https://github.com/nhost/hasura-auth/commit/4d452d7d0b374cad7deb3d59422ad973fb4d801e))

## [0.5.0](https://github.com/nhost/hasura-auth/compare/v0.4.3...v0.5.0) (2022-03-31)

## What's new

### Consistent error messages

Error messages were either sent as string or as an object (other errors). Moreover, the request payload validation was performed in two separate places in the code, as and a result, it was not possible to predict if payload validation errors were sent as a string or an object.
In addition, error codes and messages were inconsistent or missing from one endpoint to another, given the same type of error.

All errors sent back to the client now follow the same format:

```ts
{
  error: string; // machine-readable error code
  status: number; // http status
  message: string; // human-readable message
}
```

The list of errors is comprehensive and available [here](https://github.com/nhost/hasura-auth/blob/dc4a4126cd36d73a67d3e0ead07c061cd3a31f9f/src/errors.ts#L46).

Closes [#98](https://github.com/nhost/hasura-auth/issues/98), [#46](https://github.com/nhost/hasura-auth/issues/46)

### Send errors with the redirection

Until now, endpoints that were redirecting the user to the frontend client were stopping redirection when an error occurred. It lead to bad user experience as users where stopped on a

In all the endpoints that have a `redirectTo` option, errors are now instead passed on to the frontend client as a query parameter, so the frontend can handle these errors and guide the user accordingly.

The two following keys are added to the query string:

- `error`: machine-readable error code
- `errorDescription`: human-readable message

### Validate email when using Oauth providers

Email were not validated when authenticating with an Oauth provider. When the Oauth provider calls back to Hasura Auth, users with an email that don't follow the rules determined by `AUTH_ACCESS_CONTROL_ALLOWED_EMAILS`, `AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS`, `AUTH_ACCESS_CONTROL_BLOCKED_EMAILS` and `AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS` are now not able to complete authentication.

Closes [#84](https://github.com/nhost/hasura-auth/issues/84)

### Fix allowed roles validation

The validation of `allowedRoles` were failing when passed on as an option.
Closes [#116](https://github.com/nhost/hasura-auth/issues/116)

### Improve code readability

This release comes with improvements in the code structure and readiblity:

- Request payload validation is consistently done by Joi prior to the handling of the endpoint logic
- The payload validation rules have been move to each route file, instead of putting them all in the same place
- Http status codes and messages are not hard coded anymore, but are writtent with `http-status-codes`
- Helpers and utils files are restructured in a more sensible way, and exported/imported in the ESM way
- Dead code and uneless/stale comments have been removed

## [0.4.3](https://github.com/nhost/hasura-auth/compare/v0.4.2...v0.4.3) (2022-03-18)

### Features

- error redirects ([#109](https://github.com/nhost/hasura-auth/issues/109)) ([0dcb370](https://github.com/nhost/hasura-auth/commit/0dcb37028ec19cfd546a5c847a7e13f8ea9a5195))

### Bug Fixes

- root field typo ([#117](https://github.com/nhost/hasura-auth/issues/117)) ([ebb19f8](https://github.com/nhost/hasura-auth/commit/ebb19f8cea693f7e26039345a807308d052a532f))

## [0.4.2](https://github.com/nhost/hasura-auth/compare/v0.4.1...v0.4.2) (2022-03-15)

- check if photo item exists ([#115](https://github.com/nhost/hasura-auth/issues/115)) ([aab9637](https://github.com/nhost/hasura-auth/commit/aab963758652bf7ee045db7bf3691b6bc5766d17))

## [0.4.1](https://github.com/nhost/hasura-auth/compare/v0.4.0...v0.4.1) (2022-03-15)

- 0.4.0 bugs ([#114](https://github.com/nhost/hasura-auth/issues/114)) ([0024aa1](https://github.com/nhost/hasura-auth/commit/0024aa16f7e3a98bbcb7232512c82080a5f464a9))
- correct redirect url generation ([02e75cf](https://github.com/nhost/hasura-auth/commit/02e75cfd935926d235291eb7c5b9e82a6d929fe5))

## [0.4.0](https://github.com/nhost/hasura-auth/compare/v0.3.2...v0.4.0) (2022-03-14)

- provider requests signup data and redirectTo ([#108](https://github.com/nhost/hasura-auth/issues/108)) ([068f9c0](https://github.com/nhost/hasura-auth/commit/068f9c0d650b655656d78af4b719dc2289be0e67))

## [0.3.2](https://github.com/nhost/hasura-auth/compare/v0.3.1...v0.3.2) (2022-03-09)

### Bug Fixes

- patch twitch Oauth provider ([1cd9926](https://github.com/nhost/hasura-auth/commit/1cd992602b22cbd40cd5dbf44947a67ba303ef5f))undefined

## [0.3.1](https://github.com/nhost/hasura-auth/compare/v0.3.0...v0.3.1) (2022-03-04)

### Bug Fixes

- use process.env.npm_package_version instead of import 'package.json' ([ab23184](https://github.com/nhost/hasura-auth/commit/ab23184e7c9638e6ae15cd0fe14232cf3c77dd67))

## [0.3.0](https://github.com/nhost/hasura-auth/compare/v0.2.1...v0.3.0) (2022-03-02)

### Features

- add openapi/swagger endpoint ([6b92546](https://github.com/nhost/hasura-auth/commit/6b9254692810fda654c50483439c4eccc05dc7f7))
- add Twitch and Discord Oauth providers

## [0.2.1](https://github.com/nhost/hasura-auth/compare/v0.2.0...v0.2.1) (2022-02-18)

### Bug Fixes

- reload metadata after applying metadata changes ([26fb2ff](https://github.com/nhost/hasura-auth/commit/26fb2ffdef3cb5baba97a7bce8b5f0b62e58a0a3))

## [0.2.0](https://github.com/nhost/hasura-auth/compare/v0.1.0...v0.2.0) (2022-02-03)

## What's new

### Custom JWT claims

Hasura comes with a [powerful authorisation system](https://hasura.io/docs/latest/graphql/core/auth/authorization/index.html). Hasura Auth is already configured to add `x-hasura-user-id`, `x-hasura-allowed-roles`, and `x-hasura-user-isAnonymous` to the JSON Web Tokens it generates.

This release introduces the ability to define custom claims to add to the JWT, so they can be used by Hasura to determine the permissions of the received GraphQL operation.

Each custom claim is defined by a pair of a key and a value:

- The key determines the name of the claim, prefixed by `x-hasura`. For instance, `organisation-id`will become `x-hasura-organisation-id`.
- The value is a representation of the path to look at to determine the value of the claim. For instance `[profile.organisation.id](http://profile.organisation.id)` will look for the `user.profile` Hasura relationship, and the `profile.organisation` Hasura relationship. Array values are transformed into Postgres syntax so Hasura can interpret them. See the official Hasura documentation to understand the [session variables format](https://hasura.io/docs/latest/graphql/core/auth/authorization/roles-variables.html#format-of-session-variables).

```bash
AUTH_JWT_CUSTOM_CLAIMS={"organisation-id":"profile.organisation[].id", "project-ids":"profile.contributesTo[].project.id"}
```

Will automatically generate and fetch the following GraphQL query:

```graphql
{
  user(id: "<user-id>") {
    profile {
      organisation {
        id
      }
      contributesTo {
        project {
          id
        }
      }
    }
  }
}
```

It will then use the same expressions e.g. `profile.contributesTo[].project.id` to evaluate the result with [JSONata](https://jsonata.org/), and possibly transform arrays into Hasura-readable, PostgreSQL arrays.Finally, it adds the custom claims to the JWT in the `https://hasura.io/jwt/claims` namespace:

```json
{
  "https://hasura.io/jwt/claims": {
    "x-hasura-organisation-id": "8bdc4f57-7d64-4146-a663-6bcb05ea2ac1",
    "x-hasura-project-ids": "{\"3af1b33f-fd0f-425e-92e2-0db09c8b2e29\",\"979cb94c-d873-4d5b-8ee0-74527428f58f\"}",
    "x-hasura-allowed-roles": [ "me", "user" ],
    "x-hasura-default-role": "user",
    "x-hasura-user-id": "121bbea4-908e-4540-ac5d-52c7f6f93bec",
    "x-hasura-user-is-anonymous": "false"
  }
  "sub": "f8776768-4bbd-46f8-bae1-3c40da4a89ff",
  "iss": "hasura-auth",
  "iat": 1643040189,
  "exp": 1643041089
}
```

### `metadata` user field

A basic JSONB column in the `auth.users` table, that is passed on as an option on registration:

```json
{
  "email": "bob@bob.com",
  "passord": "12345678",
  "options": {
    "metadata": {
      "first_name": "Bob"
    }
  }
}
```

### Remote custom email templates

When running Hasura Auth in its own infrastructure, it is possible to mount a volume with custom `email-templates` directory. However, in some cases, we may want to fetch templates from an external HTTP endpoint. Hence the introduction of a new `AUTH_EMAIL_TEMPLATE_FETCH_URL` environment variable:

```bash
AUTH_EMAIL_TEMPLATE_FETCH_URL=https://github.com/nhost/nhost/tree/custom-email-templates-example/examples/custom-email-templates
```

In the above example, on every email creation, the server will use this URL to fetch its templates, depending on the locale, email type and field.

For instance, the template for english verification email body will the fetched in [https://raw.githubusercontent.com/nhost/nhost/custom-email-templates-example/examples/custom-email-templates/en/email-verify/body.html](https://raw.githubusercontent.com/nhost/nhost/custom-email-templates-example/examples/custom-email-templates/en/email-verify/body.html).

See the [example in the main nhost/nhost repository](https://github.com/nhost/nhost/tree/main/examples/custom-email-templates).

The context variables in email templates have been simplified: the `${link}` variable contains the entire redirection url the recipient needs to follow.

## Changelog

### Bug Fixes

- allow redirect urls in Oauth that starts with the one defined in the server ([c00bff8](https://github.com/nhost/hasura-auth/commit/c00bff8283a657c38fce3b5cbfb7c56cb17f82ab))
- **email-templates:** fallback to the default template when the requested template doesn't exist ([6a70c10](https://github.com/nhost/hasura-auth/commit/6a70c103dff19b6c3f6e9e93b0cbfa0dabbdc01a))
- **email-templates:** use the locale given as an option, then the existing user locale, then default ([31d4a89](https://github.com/nhost/hasura-auth/commit/31d4a89d58d5571c920d93839638daa07ec018ff))
- **metadata:** show column values when the column name is the same as the graphql field name ([a595941](https://github.com/nhost/hasura-auth/commit/a5959413322415a23012d67773ca65387235503d)), closes [#76](https://github.com/nhost/hasura-auth/issues/76)
- **passwordless:** don't send passwordless email when the user is disabled ([3ec9c76](https://github.com/nhost/hasura-auth/commit/3ec9c763f1b1abbda62a5b9d4c01b475a62c460b))
- remove email-templates endpoint ([5c6dbf5](https://github.com/nhost/hasura-auth/commit/5c6dbf503ff729ef928f9df105998d740c5c75e8)), closes [#75](https://github.com/nhost/hasura-auth/issues/75)

### Features

- custom claims ([01c0207](https://github.com/nhost/hasura-auth/commit/01c0207fd13446d37375e261772ee4a5ca27d108)), closes [#49](https://github.com/nhost/hasura-auth/issues/49)
- implement remote email templates with AUTH_EMAIL_TEMPLATE_FETCH_URL ([2458651](https://github.com/nhost/hasura-auth/commit/2458651a415f43e01a8917f0f8aaa75bdae11897))
- simplify email templates context ([b94cdf2](https://github.com/nhost/hasura-auth/commit/b94cdf20973b22601705a0ed0395bfc9e2699309)), closes [#64](https://github.com/nhost/hasura-auth/issues/64)
- use array custom JWT claims ([53a286a](https://github.com/nhost/hasura-auth/commit/53a286a74f74d315282c6a92b679f490a3d7336e))

### BREAKING CHANGES

- deactivate the `/email-templates` endpoint

## [0.1.0](https://github.com/nhost/hasura-auth/compare/v0.0.1-canary.0...v0.1.0) (2022-01-18)

### Bug Fixes

- Update README.md ([#27](https://github.com/nhost/hasura-auth/issues/27)) ([f51bb26](https://github.com/nhost/hasura-auth/commit/f51bb26490273215543e0905e19eeab96a7fb50c))
- better error message for redirectTo ([#59](https://github.com/nhost/hasura-auth/issues/59)) ([0b76425](https://github.com/nhost/hasura-auth/commit/0b764255e02f0f0c3a72f19863f947403dbef56d))
- everything ([da8c954](https://github.com/nhost/hasura-auth/commit/da8c954ffd4990d599b6db5b7e77d604450225fd))
- keep .env for dev in repo and updated hasura version to m1 supported image ([#60](https://github.com/nhost/hasura-auth/issues/60)) ([394d4ae](https://github.com/nhost/hasura-auth/commit/394d4ae5e2fd9d4d87575f168ea15da675f9743a))
- **password:** validate password on change ([#58](https://github.com/nhost/hasura-auth/issues/58)) ([994af31](https://github.com/nhost/hasura-auth/commit/994af3193511a594f6d659b80e92ec568b6d63b0))
- **user:** fix user schemas ([#52](https://github.com/nhost/hasura-auth/issues/52)) ([c7eb721](https://github.com/nhost/hasura-auth/commit/c7eb721f1193f487ae094e5b29aa5f4c97b0ff69))

### Features

- **emails:** translate email templates to french ([#63](https://github.com/nhost/hasura-auth/issues/63)) ([109695f](https://github.com/nhost/hasura-auth/commit/109695f0da65d9af3ad913a56300bd7ed6df5496))

### Performance Improvements

- reduce docker image from 477MB to 176MB ([5f4d2b2](https://github.com/nhost/hasura-auth/commit/5f4d2b2415e83ad4e589d3c12a23df4938ea0c14))
