# Configuration Guide

## Email configuration

Hasura Auth automatically sends transactional emails to manage the following operations:

- Sign up
- Password reset
- Email change
- Passwordless with emails

### SMTP settings

```bash
AUTH_SMTP_HOST=smtp.example.com
AUTH_SMTP_PORT=1025
AUTH_SMTP_USER=user
AUTH_SMTP_PASS=password
AUTH_SMTP_SENDER=auth@example.com
```

See the [CLI documentation](./cli.md) for all available configuration options including SMTP settings.

### Email templates

You can create your own templates to customize the emails that will be sent to the users. You can have a look at the [official email templates](https://github.com/nhost/nhost/services/auth/tree/main/email-templates) to understand how they are structured.

#### Within Docker

When using Docker, you can mount your own email templates from the local file system. You can have a look at this [docker-compose example](https://github.com/nhost/nhost/services/auth/blob/16df3e84b6c9a4f888b2ff07bd85afc34f8ed051/docker-compose-example.yaml#L41) to see how to set it up.

---

## Redirections

Some authentication operations redirects the users to the frontend application:

- After an OAuth provider completes or fails authentication, the user is redirected to the frontend
- Every email sent to the user (passwordless with email, password/email change, password reset) contains a link, that redirects the user to the frontend

In order to achieve that, you need to set the `AUTH_CLIENT_URL` environment variable, for instance:

```bash
AUTH_CLIENT_URL=https://my-app.vercel.com
```

---

## Email + password authentication

### Email checks

You can specify a list of allowed emails or domains with `AUTH_ACCESS_CONTROL_ALLOWED_EMAILS` and `AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS`.

As an example, the following environment variables will only allow `@nhost.io`, `@example.com` and `bob@smith.com` to register to the application:

```bash
AUTH_ACCESS_CONTROL_ALLOWED_EMAILS=bob@smith.com
AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS=nhost.io,example.com
```

In the above example, users with the following emails would be able to register `bob@smith.com`, `emma@example.com`, `john@nhost.io`, whereas `mary@firebase.com` won't.

Similarly, it is possible to provide a list of forbidden emails or domains with `AUTH_ACCESS_CONTROL_BLOCKED_EMAILS` and `AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS`.

### Password checks

Hasura auth does not accepts passwords with less than three characters. This limit can be changed in changing the `AUTH_PASSWORD_MIN_LENGTH` environment variable.

It is also possible to only allow [passwords that have not been pwned](https://haveibeenpwned.com/) in setting `AUTH_PASSWORD_HIBP_ENABLED` to `true`.

### Time-based one-time password (TOTP) Multi-Factor authentication

It is possible to add a step to authentication with email and password authentication. In order for users to be able to activate MFA TOTP, `AUTH_MFA_ENABLED` must be set to `true`.

<!-- TODO ## OAuth authentication -->

---

## Paswordless

### Passwordless with emails (magic links)

Hasura Auth supports email [passwordless authentication](https://en.wikipedia.org/wiki/Passwordless_authentication). It requires [SMTP](#email-configuration) to be configured properly.

Set `AUTH_EMAIL_PASSWORDLESS_ENABLED` to `true` to enable passwordless authentication.

### Passwordless with SMS

Hasura Auth supports SMS [passwordless authentication](https://en.wikipedia.org/wiki/Passwordless_authentication). It requires an SMS provider to be configured properly.

Set `AUTH_SMS_PASSWORDLESS_ENABLED` to `true` to enable SMS passwordless authentication.

#### SMS Provider Configuration

Configure the SMS provider using the `AUTH_SMS_PROVIDER` environment variable:

```bash
AUTH_SMS_PROVIDER=twilio  # or modica
```

**Twilio Configuration:**
```bash
AUTH_SMS_TWILIO_ACCOUNT_SID=your_account_sid
AUTH_SMS_TWILIO_AUTH_TOKEN=your_auth_token
AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID=your_messaging_service_id
```

**Modica Group Configuration:**
```bash
AUTH_SMS_MODICA_USERNAME=your_username
AUTH_SMS_MODICA_PASSWORD=your_password
```

### FIDO2 Webauthn

Hasura Auth supports [Webauthn authentication](https://en.wikipedia.org/wiki/WebAuthn). Users can sign up and sign in using different strong authenticators like Face ID, Touch ID, Fingerprint, Hello Windows etc. using supported devices. **Passkeys are supported for cross-device sign in.**

**Each user can sign up only once using webauthn. Existing users can add subsequent webauthn authenticators (new device or browser) via `/user/webauthn/add`, which requires Bearer authentication token.**

Enabling and configuring of the Webauthn can be done by setting these env variables:

```bash
AUTH_SERVER_URL=https://nhost-auth.com
AUTH_WEBAUTHN_ENABLED=true
AUTH_WEBAUTHN_RP_NAME='My App'
AUTH_WEBAUTHN_RP_ORIGINS=https://my-app.vercel.com
```

By default if `AUTH_CLIENT_URL` is set, will be whitelisted as allowed origin for such authentication. Additional urls can be specified using `AUTH_WEBAUTHN_RP_ORIGINS`.

---

## Gravatar

Hasura Auth stores the avatar URL of users in `auth.users.avatar_url`. By default, it will look for the Gravatar linked to the email, and store it into this field.
It is possible to deactivate the use of Gravatar in setting the `AUTH_GRAVATAR_ENABLED` environment variable to `false`.
