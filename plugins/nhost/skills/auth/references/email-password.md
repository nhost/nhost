# Email/password auth with @nhost/nhost-js v4

Sources: https://docs.nhost.io/products/auth/sign-in-email-password, https://docs.nhost.io/products/auth/pkce, https://docs.nhost.io/getting-started/tutorials/react/3-user-authentication, https://docs.nhost.io/reference/javascript/nhost-js/main

Samples below are framework-neutral. For React/Vue/Svelte/Next.js page wiring follow the matching tutorial (`/getting-started/tutorials/<framework>/3-user-authentication`) and the `frontend` skill.

## Client

```ts
import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local", // cloud: project subdomain
  region: "local",    // cloud: project region
});
```

`createClient` stores the session (localStorage in browsers, memory otherwise), attaches the access token to every request, refreshes it before it expires, and updates storage from auth responses. Create one client per app.

## Sign up

When email verification is on (default), generate a PKCE pair first and keep the verifier across the redirect:

```ts
import { generatePKCEPair } from "@nhost/nhost-js/auth";

const { verifier, challenge } = await generatePKCEPair();
localStorage.setItem("nhost_pkce_verifier", verifier);

const response = await nhost.auth.signUpEmailPassword({
  email,
  password,
  options: {
    displayName,                                   // optional
    redirectTo: `${window.location.origin}/verify`,
  },
  codeChallenge: challenge,
});

if (response.body?.session) {
  // verification disabled: user is signed in
} else {
  // verification required: show "check your email"
}
```

- `options` also accepts `locale`, `metadata` (JSON stored in `users.metadata`), `defaultRole`, `allowedRoles`. Roles must be within the project's allowed roles, and `defaultRole` must be in `allowedRoles`; otherwise the call fails (`role-not-allowed`, `default-role-must-be-in-allowed-roles`).
- If `redirectTo` is omitted, the link goes to `auth.redirections.clientUrl`.
- `passwordMinLength` defaults to 9 in `[auth.method.emailPassword]`. Match your form validation to the configured value.

Resend the verification email:

```ts
const { verifier, challenge } = await generatePKCEPair();
localStorage.setItem("nhost_pkce_verifier", verifier);

await nhost.auth.sendVerificationEmail({
  email,
  options: { redirectTo: `${window.location.origin}/verify` },
  codeChallenge: challenge,
});
```

## Verify page (code exchange)

The link redirects to `redirectTo?code=...`. Exchange the code once, with the stored verifier:

```ts
const code = new URLSearchParams(window.location.search).get("code");
const codeVerifier = localStorage.getItem("nhost_pkce_verifier");
localStorage.removeItem("nhost_pkce_verifier");

if (!code || !codeVerifier) {
  // show error: the flow must be started in the same browser
} else {
  await nhost.auth.tokenExchange({ code, codeVerifier }); // throws on failure
  // session is now stored; navigate to the app
}
```

Codes are single-use and expire after 5 minutes, so make sure the exchange runs only once per code (the tutorials guard it with an `isMounted` flag).

## Sign in

```ts
try {
  const response = await nhost.auth.signInEmailPassword({ email, password });
  if (response.body?.session) {
    // signed in
  } else if (response.body?.mfa) {
    // MFA enabled: complete with nhost.auth.verifySignInMfaTotp (see /products/auth/mfa)
  }
} catch (err) {
  // FetchError; err.message e.g. "Incorrect email or password"
}
```

Error handling (from the SDK reference):

```ts
import { FetchError } from "@nhost/nhost-js/fetch";

try {
  await nhost.auth.signInEmailPassword({ email, password });
} catch (err) {
  if (!(err instanceof FetchError)) throw err;
  // err.body.error: machine code, err.body.message: text, err.status: HTTP status
}
```

Useful `err.body.error` codes (from the Auth service source): `invalid-email-password` (401), `unverified-user` (401, email not verified yet), `redirectTo-not-allowed` (bad `redirectTo`), `password-too-short`. With `[auth.misc] concealErrors = true` some codes are replaced by a generic error.

## Session

```ts
const session = nhost.getUserSession(); // StoredSession | null
// session.accessToken, session.refreshToken, session.refreshTokenId,
// session.user, session.decodedToken["https://hasura.io/jwt/claims"]

const unsubscribe = nhost.sessionStorage.onChange((session) => {
  // fires when this client sets or removes the session (sign-in, refresh, sign-out); session may be null
});

await nhost.refreshSession();   // refresh if expiring within 60 s (default margin)
await nhost.refreshSession(0);  // force refresh
const me = await nhost.auth.getUser(); // me.body is the User
```

Access token lifetime: `[auth.session.accessToken] expiresIn` (default 900 s); refresh token: `[auth.session.refreshToken] expiresIn` (default 2592000 s).

## Sign out

```ts
const session = nhost.getUserSession();
if (session) {
  await nhost.auth.signOut({ refreshToken: session.refreshToken });
}
```

`signOut({ all: true })` signs out all devices. The SDK removes the stored session after any `/signout` call. `nhost.clearSession()` only clears local storage and does not invalidate the refresh token on the server; prefer `signOut`.

## Password reset and change

```ts
const { verifier, challenge } = await generatePKCEPair();
localStorage.setItem("nhost_pkce_verifier", verifier);

await nhost.auth.sendPasswordResetEmail({
  email,
  options: { redirectTo: `${window.location.origin}/verify` },
  codeChallenge: challenge,
});
```

After the reset link's code is exchanged (same verify page), the user is signed in and can set a new password:

```ts
await nhost.auth.changeUserPassword({ newPassword });
```

A successful password change revokes all of the user's sessions, including the current one; the SDK clears the stored session. Send the user to sign in again.

Email change: `nhost.auth.changeUserEmail({ newEmail, options: { redirectTo }, codeChallenge })`; it may require elevated permissions (see https://docs.nhost.io/products/auth/elevated-permissions).
