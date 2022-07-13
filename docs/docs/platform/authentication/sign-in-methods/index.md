---
title: 'Sign-In Methods'
slug: /platform/authentication/sign-in-methods
image: /img/og/platform/sign-in-methods.png
---

Nhost Authentication support the following sign-in methods:

- [Email and Password](/platform/authentication/sign-in-with-email-and-password)
- [Magic Link](/platform/authentication/sign-in-with-magic-link)
- [Phone Number (SMS)](/platform/authentication/sign-in-with-phone-number-sms)
- [Google](/platform/authentication/sign-in-with-google)
- [Facebook](/platform/authentication/sign-in-with-facebook)
- [GitHub](/platform/authentication/sign-in-with-github)
- [LinkedIn](/platform/authentication/sign-in-with-linkedin)
- [Spotify](/platform/authentication/sign-in-with-spotify)

## Enabling Social Sign-In Provider

To start with social sign-in, select your app in Nhost Console and go to **Users** → **Authentication Settings**.

You need to set the Client ID and Client Secret for each provider that you want to enable.

## Implementing sign-in experience

Use the [Nhost JavaScript SDK](/reference/javascript) and the `signIn()` method to implement social sign-in in your app,

Here's an example of how to implement sign-in with GitHub:

```js
nhost.auth.signIn({
  provider: 'github'
})
```

Users are redirected to your Nhost app's **client URL** by default. By default, your Nhost app's client URL is set to `http://localhost:3000`. You can change the value of your client URL in the Nhost console by going to **Users** → **Authentication Settings** → **Client URL**.


Here is an example of how to redirect to another host or path:

```js
nhost.auth.signIn({
  provider: '<provider>'
  options: {
    redirectTo: "<host>/<slug>" // Example: "https://example.com/dashboard"
  },
})
```

## Provider OAuth scopes

Scopes are a mechanism in OAuth to allow or limit an application's access to a user's account.

By default, Nhost sets the scope to get the name, email, and avatar url for each user. Editing scope is not currently supported.

## Provider OAuth Tokens

Nhost saves both access and refresh tokens for each user and provider in the `auth.user_providers` table. These tokens can be used to interact with the provider if needed.
