---
name: auth
description: Covers Nhost Auth - email/password sign up, sign in and sign out with @nhost/nhost-js v4 (nhost.auth.signUpEmailPassword, signInEmailPassword, signOut, tokenExchange), sessions (getUserSession, refreshSession, sessionStorage.onChange), email verification with PKCE, password reset, redirect URLs (clientUrl, allowedUrls, "redirectTo-not-allowed"), local verification emails in Mailhog, roles (default role user, allowed roles, x-hasura-role), JWT access tokens and custom claims, and where to change auth settings (nhost.toml or dashboard). Also maps other Nhost sign-in methods (magic link, email/SMS OTP, WebAuthn passkeys, social/OAuth providers, anonymous, MFA, OAuth2 provider). Use when a user of an Nhost project wants login, signup, logout, session handling, email verification, roles or JWT claims. Not for table permissions, route protection/SSR wiring, or file storage.
---

# Nhost Auth

Nhost Auth issues a short-lived JWT access token plus a refresh token. The JWT carries the user's roles and session variables (`x-hasura-user-id`, custom claims) that the GraphQL API and Storage use for permissions. Email/password sign-in is enabled by default. Docs: https://docs.nhost.io/products/auth

Look things up before answering: MCP `search` / `read_page`, or `nhost docs search "<q>"` / `nhost docs show <path>`, or https://docs.nhost.io/llms.txt. The SDK reference is https://docs.nhost.io/reference/javascript/nhost-js/auth.

## Rules

- SDK is `@nhost/nhost-js` v4. Create the client with `createClient({ subdomain, region })` (local: `"local"` / `"local"`). Methods return `{ body, status, headers }` and throw `FetchError` on status >= 300; use `try/catch`, read `response.body.session`.
- Do NOT use v3 idioms: `new NhostClient`, `nhost.auth.signUp` / `nhost.auth.signIn`, `onAuthStateChanged`, `{ data, error }` destructuring, packages `@nhost/react`, `@nhost/nextjs`, `@nhost/react-apollo`, `@nhost/vue`.
- Some docs pages show method names that do not exist in the SDK. Use the source names: `sendVerificationEmail` (not `userEmailSendVerificationEmail`), `sendPasswordResetEmail` (not `userPasswordReset`), `changeUserPassword` (not `changePassword`), `changeUserEmail` (not `userEmailChange`).
- Never put the admin secret (`x-hasura-admin-secret`, `withAdminSession`) in frontend code or committed files. Frontend auth uses the user's session only.
- Keep email verification on (`emailVerificationRequired = true`, the default). Never disable it for production. Only turn it off locally if the user asks, and say it is local only.
- Always pass a PKCE `codeChallenge` for flows that send an email link (sign-up with verification, resend verification, password reset, email change). Without it the redirect carries a refresh token in the URL.
- Do not create users by inserting into `auth.users` (except for user imports) and do not change the `auth` schema.

## Email/password flow (summary)

1. Sign up with `nhost.auth.signUpEmailPassword({ email, password, options: { redirectTo }, codeChallenge })`, after `generatePKCEPair()` from `@nhost/nhost-js/auth` and storing the verifier in `localStorage`.
2. With verification on, `response.body.session` is empty. Show "check your email"; do not treat it as an error or redirect to a protected page.
3. The email link redirects to `redirectTo` with `?code=`. That page calls `nhost.auth.tokenExchange({ code, codeVerifier })`; the SDK stores the session.
4. Sign in with `nhost.auth.signInEmailPassword({ email, password })`; the session is in `response.body.session`. If MFA is on, the body has `mfa` instead.
5. Sign out with `nhost.auth.signOut({ refreshToken: session.refreshToken })`; the SDK clears the stored session.
6. Read the session with `nhost.getUserSession()`, react to changes with `nhost.sessionStorage.onChange(cb)` (returns an unsubscribe function). `createClient` refreshes tokens automatically.

Full code, password reset, error codes: [references/email-password.md](references/email-password.md). Read it before writing any auth code.

## Redirect URLs (most common failure)

`redirectTo` must start with `auth.redirections.clientUrl` (default `http://localhost:3000`) or one of `auth.redirections.allowedUrls`; otherwise the call fails with `redirectTo-not-allowed`. Scheme, host and port must match, so a Vite app on `http://localhost:5173` fails with the default config. Fix it in config, not by dropping `redirectTo`:

```toml
[auth.redirections]
clientUrl = 'http://localhost:5173'
allowedUrls = ['http://localhost:5173']
```

Add the production domain in the cloud project's settings before deploying. https://docs.nhost.io/products/auth/client_and_redirect_urls

## Local development

- Verification and reset emails are not delivered locally. Open Mailhog at https://local.mailhog.local.nhost.run to click the link.
- Auth settings live in `nhost/nhost.toml` under `[auth]`. Edit it, then run `nhost up` again. Reference: https://docs.nhost.io/reference/configuration#auth
- Only if the user asks to skip verification locally:

```toml
[auth.method.emailPassword]
emailVerificationRequired = false
```

  Tell the user this is for local development only and must stay `true` in the cloud project.
- Cloud projects: change settings in the Nhost Dashboard (Settings -> Sign-In Methods, Roles and Permissions, Authentication), or use `nhost config pull` / `nhost config apply`. Ask before changing a cloud project's settings.

## Roles and claims

Every user has a default role (`user` by default) and allowed roles (`user`, `me` by default). Requests use the default role unless the `x-hasura-role` header names another allowed role. Unauthenticated requests use `public`. Custom claims are added under `[[auth.session.accessToken.customClaims]]` and appear as `x-hasura-<key>` in the JWT. Details, samples and JWT signing: [references/roles-and-claims.md](references/roles-and-claims.md).

## Other sign-in methods

Magic link, email OTP, SMS OTP, WebAuthn, social providers, anonymous, MFA, OAuth2 provider, bot protection, email templates: links and SDK method names in [references/other-methods.md](references/other-methods.md). Always read the linked doc page before implementing one.

## Out of scope (other skills)

- Table permissions and permission rules using these roles and claims: `database` skill.
- Auth context/provider, protected routes, SSR cookies, middleware: `frontend` skill.
- File upload and storage permissions: `storage` skill.

## Stop and ask the user

- Before disabling email verification anywhere, or changing auth settings on a cloud project.
- Before adding a role to `allowed` roles or setting a non-default `defaultRole` / `allowedRoles` at sign-up.
- When the frontend URL/port or the production domain is unknown and a `redirectTo` is needed.

The user's instructions take precedence over this skill.
