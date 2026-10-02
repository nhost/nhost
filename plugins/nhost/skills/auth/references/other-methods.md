# Other Nhost sign-in methods (map)

Read the linked page before implementing any of these; this file only lists where to look. Methods are off by default (except email/password) and are enabled in `nhost/nhost.toml` locally or in the Dashboard (Settings -> Sign-In Methods) for cloud projects. Flows that redirect back to the app (magic link, OAuth providers, WebAuthn, deanonymization) use PKCE and the same `redirectTo` rules and verify page (`nhost.auth.tokenExchange`) as email verification; see [email-password.md](email-password.md).

| Method | nhost.toml key | SDK methods (v4) | Docs |
|---|---|---|---|
| Magic link (passwordless email) | `[auth.method.emailPasswordless] enabled` | `signInPasswordlessEmail` | https://docs.nhost.io/products/auth/sign-in-magic-link |
| Email OTP | `[auth.method.otp.email] enabled` | `signInOTPEmail`, `verifySignInOTPEmail` | https://docs.nhost.io/products/auth/otp/email |
| SMS OTP (Twilio) | `[auth.method.smsPasswordless] enabled` | `signInPasswordlessSms`, `verifySignInPasswordlessSms` | https://docs.nhost.io/products/auth/otp/sms |
| WebAuthn / passkeys | `[auth.method.webauthn] enabled` | `signUpWebauthn`, `verifySignUpWebauthn`, `signInWebauthn`, `verifySignInWebauthn`, `addSecurityKey`, `verifyAddSecurityKey` | https://docs.nhost.io/products/auth/webauthn |
| Social / OAuth providers (Google, GitHub, Apple, ...) | `[auth.method.oauth.<provider>]` | `signInProviderURL(provider, { redirectTo, codeChallenge })` | https://docs.nhost.io/products/auth/providers and https://docs.nhost.io/products/auth/providers/sign-in-provider |
| ID tokens (native Apple/Google sign-in) | see page | `signInIdToken`, `linkIdToken` | https://docs.nhost.io/products/auth/providers/idtokens |
| Anonymous | `[auth.method.anonymous] enabled` | `signInAnonymous`, `deanonymizeUser` | https://docs.nhost.io/products/auth/sign-in-anonymous |
| MFA (TOTP) | `[auth.totp] enabled` | `changeUserMfa`, `verifyChangeUserMfa`, `verifySignInMfaTotp` | https://docs.nhost.io/products/auth/mfa |
| Nhost as OAuth2 / OIDC provider | `[auth.oauth2Provider] enabled` | `oauth2*` methods | https://docs.nhost.io/products/auth/oauth2-provider |

Enter provider client IDs and secrets in the Nhost OAuth settings for that provider (per the provider pages). Never put a client secret in committed files or frontend code.

## Related settings

- Elevated (step-up) permissions for sensitive actions: https://docs.nhost.io/products/auth/elevated-permissions
- Control who can sign up (disable sign-up, disable new users, require explicit registration): https://docs.nhost.io/products/auth/controlling-user-creation
- Allow/block emails and domains: https://docs.nhost.io/products/auth/restricting_emails_and_domains
- Bot protection (Cloudflare Turnstile): https://docs.nhost.io/products/auth/bot-protection
- Customize verification/reset/OTP emails: https://docs.nhost.io/products/auth/email-templates
- Gravatar defaults: https://docs.nhost.io/products/auth/gravatar
