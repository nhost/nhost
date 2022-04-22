---
title: 'Email templates'
sidebar_position: 4
---

The following emails can be sent as part of the authentication flow:

- Sign up confirmation email (when using email + password)
- Reset password email (when using email + password)
- Passwordless login email (when using Magic Link)
- Confirm email change (any sign-up method)

---

## Enabling custom email templates

If you have developed custom email templates, you must make them available over HTTP and then point Nhost to them. You can host the templates on your server, or use a public repository on GitHub.

Go to **Users -> Login settings** and scroll down to **Custom email templates**, and set the URL to where your templates are located:

![Email templates](/img/platform/email-templates.svg)

You only need to define the base URL to point to your hosted templates. The UI will give you a hint about where Nhost will look for your actual template files.

---

## File structure

The email templates should be provided as body.html and subject.txt files in this predefined folder structure:

```txt
// At base URL (e.g. https://yourapp.com/email-templates/)
en/
  email-confirm-change/
    body.html
    subject.txt
  email-verify/
    body.html
    subject.txt
  password-reset/
    body.html
    subject.txt
  signin-passwordless/
    body.html
    subject.txt

// Other language versions
fr/
  /* ... */
se/
  /* ... */
```

You don’t have to provide all templates - only the one you wish to use and customize. For the templates you do provide, you must provide both body.html and subject.txt.

[View example on GitHub](https://github.com/nhost/nhost/tree/main/examples/custom-email-templates)

---

## Localisation

If Nhost finds a template that matches the recipent user’s locale, the email will be sent in that language. Use two-letter language codes to set the locale.
English will always be used as the default if another language version is not found.

---

## Template variables

Use variables like `${displayName}` to make your templates more dynamic:

```html
<!-- https://yourapp.com/email-templates/en/email-verify/body.html -->
<h2>Confirm Email Change</h2>

<p>Hi, ${displayName}! Please click this link to verify your email:</p>

<p>
  <a href="${displayName}">Verify new email</a>
</p>
```

These variables can be used either in the template subject or body. The following variables are supported:

| Variable    | Description                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| link        | The full URL to the target of the transaction. This should be used in the main call to action. This is available in all templates. |
| displayName | The display name of the user.                                                                                                      |
| email       | The email of the user.                                                                                                             |
| locale      | Locale of the user as a two-letter language code. E.g. "en".                                                                       |

---

<!-- ## Developing emails templates locally -->
