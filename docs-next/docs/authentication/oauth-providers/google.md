---
title: Sign In with Google
sidebar_position: 1
---

Follow this guide to sign in users with Google with your Nhost App.

![Google Sign In Preview](/img/social-providers/google-preview.png)

## Sign up for Google

- Sign up for [Google Cloud](https://cloud.google.com/free) if you don’t have one already.

## Create a Google Cloud Project

> 💡 You can skip this step if you already have a Google Cloud project you want to use.

- Create a new Google Cloud project if you don’t already have a project you want to use.

## Configure OAuth consent screen

- Search for **OAuth consent screen** in the top search bar in the Google Cloud Console.
- Click on **OAuth consent screen** in the search results.
- Select User Type **External** and click **CREATE**.

## **Edit app registration**

### OAuth consent screen

- Fill in your App information.
- Click **SAVE AND CONTINUE.**

### Scopes

- Click **SAVE AND CONTINUE**.

### Test user

- Click **SAVE AND CONTINUE**.

### Summary

- Click **BACK TO DASHBOARD**.

## Create credentials

- Click on **Credentials** under **APIs & Services** in the left menu.
- Click **+ CREATE CREDENTIALS** and then **OAuth client ID** in the top menu.
- On the **Create OAuth client ID** page for **Application Type** select **Web application**.
- Under **Authorized redirect URIs** add your **OAuth Callback URL** from Nhost.
- Click **CREATE**.

## Configure Nhost

- A modal appears with your Google Client ID and Client secret.
- Copy and paste the **Client ID** and **Client Secret** from Google to your Nhost OAuth settings for Google. Make sure the [OAuth provider is enabled in Nhost](/platform/authentication/social-sign-in#enabling-social-sign-in).
- Click the checkbox “**I have pasted the redirect URI into Google”**.
- Click **Confirm settings**.

## Sign In users in your app

Use the [Nhost JavaScript client](/reference/sdk) to sign in users in your app:

```js
nhost.auth.signIn({
  provider: 'google'
})
```
