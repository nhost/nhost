---
title: 'OAuth Providers'
---

Nhost Auth supports the following social sign-in providers:

- [Google](/platform/authentication/oauth-providers/google)
- [Facebook](/platform/authentication/oauth-providers/facebook)
- [GitHub](/platform/authentication/oauth-providers/github)
- [LinkedIn](/platform/authentication/oauth-providers/linkedin)
- [Spotify](/platform/authentication/oauth-providers/spotify)

---

## Enabling Social Sign-In Provider

To start with social sign-in, select your app in Nhost Console and go to **Users** → **Login settings**.

You need to set client ID and client secret for each provider that you want to enable.

---

## Implementing sign-in experience

Use the [Nhost JavaScript SDK](/reference/sdk/overview) and the `signIn()` method to implement social sign-in in your app,

Here's an example of how to implement sign-in with GitHub:

```js
nhost.auth.signIn({
  provider: 'github',
});
```

Users are redirected to your Nhost app's **client URL** by default. By default your Nhost app's client URL is set to `http://localhost:3000`. You can change the value of your client URL in the Nhost console by going to **Users** → **Login settings** → **Client URL**.

---

## Provider OAuth scopes

Scopes are a mechanism in OAuth to allow or limit an application's access to a user's account.

By default, Nhost sets the scope to get the name, email and avatar for each user. Editing scope is not currently supported.

## Provider OAuth Tokens

Nhost saves both access and refresh tokens for each user and provider in the `auth.user_providers` table. These tokens can be used to interact with the provider if needed.
