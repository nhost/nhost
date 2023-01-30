---
title: 'Sign-In Methods'
slug: /authentication/sign-in-methods
image: /img/og/sign-in-methods.png
---

Nhost Authentication supports the following sign-in methods:

- [Email and Password](/authentication/sign-in-with-email-and-password)
- [Magic Link](/authentication/sign-in-with-magic-link)
- [Phone Number (SMS)](/authentication/sign-in-with-phone-number-sms)
- [Security Keys (WebAuthn)](/authentication/sign-in-with-security-keys)
- [Apple](/authentication/sign-in-with-apple)
- [Discord](/authentication/sign-in-with-discord)
- [Facebook](/authentication/sign-in-with-facebook)
- [GitHub](/authentication/sign-in-with-github)
- [Google](/authentication/sign-in-with-google)
- [LinkedIn](/authentication/sign-in-with-linkedin)
- [Spotify](/authentication/sign-in-with-spotify)
- [Twitch](/authentication/sign-in-with-twitch)

## Enabling sign-in methods during local development

To enable a sign-in method locally, add variables corresponding to the relevant authentication methods in an `.env.development` file located in the project repository. An overview of available options is available in the [Hasura Auth repository](https://github.com/nhost/hasura-auth/blob/main/docs/environment-variables.md#oauth-environment-variables).
