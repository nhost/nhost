---
title: 'Sign-in methods'
sidebar_position: 2
---

Nhost supports a variety of sign-in methods:

---

## Email + password

To sign in a user with email and password, the user must first sign up:

```js
await nhost.auth.signUp({
  email: 'joe@nhost.io',
  password: 'secret-password',
});
```

If you've turned on email verification in your app's **login settings**, a user will be sent a verification email upon signup. The user must click the verification link in the email before they can log in.

Once a user has been signed up (and optionally verified), you can sign them in:

```js
await nhost.auth.signIn({
  email: 'joe@nhost.io',
  password: 'secret-password',
});
```

---

## Passwordless email (magic link)

Users can sign in with passwordless email, also called magic link.

When a user signs in with passwordless email, Nhost will create the user if they don't already exist and send an email to the user.

When a user clicks the link in the email, they will be redirected to your app and automatically signed in.

Example in JavaScript:

```js
await nhost.auth.signIn({
  email: 'joe@nhost.io',
});
```

---

## Passwordless SMS

Users can sign in with passwordless SMS. The passwordless SMS sign in method has a flow:

First, "sign in" the user with a phone number.

```js
await nnhost.auth.signIn({
  phoneNumber: '+467610337135',
});
```

This will create the user if the user does not already exist, and send a One Time Password (OTP) to the user's
phone number.

Use the OTP to finalize the sign-in:

```js
await nhost.auth.signIn({
  phoneNumber: '+467610337135',
  otp: 'otp-from-sms',
});
```

---

## Anonymous

A user can be created anonymously. This is useful for offering a limited version of your application to your users without having them sign in first.

An anonymous user gets a user ID with the `anonymous` role. This role can be used to [set permissions in Hasura](/platform/database/permissions).

### Deanonymize users

Anonymous users can be converted to "normal" users by deanonymize the user.
