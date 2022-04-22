---
title: Environment variables
sidebar_position: 3
---

## General environment variables

| Name (a star**\*** means the variable is required) | Description                                                                                                                                                                                            | Default value                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| HASURA_GRAPHQL_JWT_SECRET**\***                    | Key used for generating JWTs. Must be `HMAC-SHA`-based and the same as configured in Hasura. [More info](https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt.html#running-with-jwt)     |                              |
| HASURA_GRAPHQL_DATABASE_URL**\***                  | [PostgreSQL connection URI](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING). Required to inject the `auth` schema into the database.                                      |                              |
| HASURA_GRAPHQL_GRAPHQL_URL**\***                   | Hasura GraphQL endpoint. Required to manipulate account data. For instance: `https://graphql-engine:8080/v1/graphql`                                                                                   |                              |
| HASURA_GRAPHQL_ADMIN_SECRET**\***                  | Hasura GraphQL Admin Secret. Required to manipulate account data.                                                                                                                                      |                              |
| AUTH_HOST                                          | Server host. This option is available until Hasura-auth `v0.6.0`. [Docs](http://expressjs.com/en/5x/api.html#app.listen)                                                                               | `0.0.0.0`                    |
| AUTH_PORT                                          | Server port. [Docs](http://expressjs.com/en/5x/api.html#app.listen)                                                                                                                                    | `4000`                       |
| AUTH_SERVER_URL                                    | Server URL of where Hasura Backend Plus is running. This value is to used as a callback in email templates and for the OAuth authentication process.                                                   |                              |
| AUTH_CLIENT_URL                                    | URL of your frontend application. Used to redirect users to the right page once actions based on emails or OAuth succeed.                                                                              |                              |
| AUTH_SMTP_HOST                                     | SMTP server hostname used for sending emails                                                                                                                                                           |                              |
| AUTH_SMTP_PORT                                     | SMTP port                                                                                                                                                                                              | `587`                        |
| AUTH_SMTP_USER                                     | Username to use to authenticate on the SMTP server                                                                                                                                                     |                              |
| AUTH_SMTP_PASS                                     | Password to use to authenticate on the SMTP server                                                                                                                                                     |                              |
| AUTH_SMTP_SENDER                                   | Email to use in the `From` field of the email                                                                                                                                                          |                              |
| AUTH_SMTP_AUTH_METHOD                              | SMTP authentication method                                                                                                                                                                             | `PLAIN`                      |
| AUTH_SMTP_SECURE                                   | Enables SSL. [More info](https://nodemailer.com/smtp/#tls-options).                                                                                                                                    | `false`                      |
| AUTH_GRAVATAR_ENABLED                              |                                                                                                                                                                                                        | `true`                       |
| AUTH_GRAVATAR_DEFAULT                              |                                                                                                                                                                                                        | `blank`                      |
| AUTH_GRAVATAR_RATING                               |                                                                                                                                                                                                        | `g`                          |
| AUTH_ANONYMOUS_USERS_ENABLED                       | Enables users to register as an anonymous user.                                                                                                                                                        | `false`                      |
| AUTH_DISABLE_NEW_USERS                             | If set, new users will be disabled after finishing registration and won't be able to connect.                                                                                                          | `false`                      |
| AUTH_ACCESS_CONTROL_ALLOWED_EMAILS                 | Comma-separated list of emails that are allowed to register.                                                                                                                                           |                              |
| AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS          | Comma-separated list of email domains that are allowed to register. If `ALLOWED_EMAIL_DOMAINS` is `tesla.com,ikea.se`, only emails from tesla.com and ikea.se would be allowed to register an account. | `` (allow all email domains) |
| AUTH_ACCESS_CONTROL_BLOCKED_EMAILS                 | Comma-separated list of emails that cannot register.                                                                                                                                                   |                              |
| AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS          | Comma-separated list of email domains that cannot register.                                                                                                                                            |                              |
| AUTH_PASSWORD_MIN_LENGTH                           | Minimum password length.                                                                                                                                                                               | `3`                          |
| AUTH_PASSWORD_HIBP_ENABLED                         | User's password is checked against [Pwned Passwords](https://haveibeenpwned.com/Passwords).                                                                                                            | `false`                      |
| AUTH_USER_DEFAULT_ROLE                             | Default user role for registered users.                                                                                                                                                                | `user`                       |
| AUTH_USER_DEFAULT_ALLOWED_ROLES                    | Comma-separated list of default allowed user roles.                                                                                                                                                    | `me,$AUTH_USER_DEFAULT_ROLE` |
| AUTH_LOCALE_DEFAULT                                |                                                                                                                                                                                                        | `en`                         |
| AUTH_LOCALE_ALLOWED_LOCALES                        |                                                                                                                                                                                                        | `en`                         |
| AUTH_EMAIL_PASSWORDLESS_ENABLED                    | Enables passwordless authentication by email. The SMTP server must then be configured.                                                                                                                 | `false`                      |
| AUTH_SMS_PASSWORDLESS_ENABLED                      | Enables passwordless authentication by SMS. An SMS provider must then be configured.                                                                                                                   | `false`                      |
| AUTH_SMS_PROVIDER                                  | SMS provider name. Only `twilio` is possible as an option for now.                                                                                                                                     |                              |
| AUTH_SMS_TWILIO_ACCOUNT_SID                        |                                                                                                                                                                                                        |                              |
| AUTH_SMS_TWILIO_AUTH_TOKEN                         |                                                                                                                                                                                                        |                              |
| AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID               |                                                                                                                                                                                                        |                              |
| AUTH_SMS_TWILIO_FROM                               |                                                                                                                                                                                                        |                              |
| AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED          | When enabled, any email-based authentication requires emails to be verified by a link sent to this email.                                                                                              | `true`                       |
| AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS          |                                                                                                                                                                                                        |                              |
| AUTH_MFA_ENABLED                                   | Enables users to use Multi Factor Authentication.                                                                                                                                                      | `false`                      |
| AUTH_MFA_TOTP_ISSUER                               | The name of the One Time Password (OTP) issuer. Probably your app's name.                                                                                                                              | `hasura-auth`                |
| AUTH_ACCESS_TOKEN_EXPIRES_IN                       | Number of seconds before the access token (JWT) expires.                                                                                                                                               | `900`(15 minutes)            |
| AUTH_REFRESH_TOKEN_EXPIRES_IN                      | Number of seconds before the refresh token expires.                                                                                                                                                    | `2592000` (30 days)          |
| AUTH_EMAIL_TEMPLATE_FETCH_URL                      |                                                                                                                                                                                                        |                              |
| AUTH_JWT_CUSTOM_CLAIMS                             |                                                                                                                                                                                                        |                              |

## OAuth environment variables

| Name (a star**\*** means the variable is required when the provider is enabled) | Default value                       |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| AUTH_PROVIDER_GITHUB_ENABLED                                                    | `false`                             |
| AUTH_PROVIDER_GITHUB_CLIENT_ID**\***                                            |                                     |
| AUTH_PROVIDER_GITHUB_CLIENT_SECRET**\***                                        |                                     |
| AUTH_PROVIDER_GITHUB_AUTHORIZATION_URL                                          |                                     |
| AUTH_PROVIDER_GITHUB_TOKEN_URL                                                  |                                     |
| AUTH_PROVIDER_GITHUB_USER_PROFILE_URL                                           |                                     |
| AUTH_PROVIDER_GITHUB_SCOPE                                                      | `user:email `                       |
| AUTH_PROVIDER_GOOGLE_ENABLED                                                    | `false`                             |
| AUTH_PROVIDER_GOOGLE_CLIENT_ID**\***                                            |                                     |
| AUTH_PROVIDER_GOOGLE_CLIENT_SECRET**\***                                        |                                     |
| AUTH_PROVIDER_GOOGLE_SCOPE                                                      | `email,profile`                     |
| AUTH_PROVIDER_FACEBOOK_ENABLED                                                  | `false`                             |
| AUTH_PROVIDER_FACEBOOK_CLIENT_ID**\***                                          |                                     |
| AUTH_PROVIDER_FACEBOOK_CLIENT_SECRET**\***                                      |                                     |
| AUTH_PROVIDER_FACEBOOK_PROFILE_FIELDS                                           | `email,photos,displayName`          |
| AUTH_PROVIDER_FACEBOOK_SCOPE                                                    | `email`                             |
| AUTH_PROVIDER_TWITTER_ENABLED                                                   | `false`                             |
| AUTH_PROVIDER_TWITTER_CONSUMER_KEY**\***                                        |                                     |
| AUTH_PROVIDER_TWITTER_CONSUMER_SECRET**\***                                     |                                     |
| AUTH_PROVIDER_LINKEDIN_ENABLED                                                  |                                     |
| AUTH_PROVIDER_LINKEDIN_CLIENT_ID**\***                                          |                                     |
| AUTH_PROVIDER_LINKEDIN_CLIENT_SECRET**\***                                      |                                     |
| AUTH_PROVIDER_LINKEDIN_SCOPE                                                    | `r_emailaddress,r_liteprofile`      |
| AUTH_PROVIDER_APPLE_ENABLED                                                     | `false`                             |
| AUTH_PROVIDER_APPLE_CLIENT_ID**\***                                             |                                     |
| AUTH_PROVIDER_APPLE_TEAM_ID**\***                                               |                                     |
| AUTH_PROVIDER_APPLE_KEY_ID**\***                                                |                                     |
| AUTH_PROVIDER_APPLE_PRIVATE_KEY**\***                                           | Base64 format                       |
| AUTH_PROVIDER_APPLE_SCOPE                                                       | `name,email`                        |
| AUTH_PROVIDER_WINDOWS_LIVE_ENABLED                                              | `false`                             |
| AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_ID**\***                                      |                                     |
| AUTH_PROVIDER_WINDOWS_LIVE_CLIENT_SECRET**\***                                  |                                     |
| AUTH_PROVIDER_WINDOWS_LIVE_SCOPE                                                | `wl.basic,wl.emails`                |
| AUTH_PROVIDER_SPOTIFY_ENABLED                                                   | `false`                             |
| AUTH_PROVIDER_SPOTIFY_CLIENT_ID**\***                                           |                                     |
| AUTH_PROVIDER_SPOTIFY_CLIENT_SECRET**\***                                       |                                     |
| AUTH_PROVIDER_SPOTIFY_SCOPE                                                     | `user-read-email,user-read-private` |
| AUTH_PROVIDER_GITLAB_ENABLED                                                    | `false`                             |
| AUTH_PROVIDER_GITLAB_CLIENT_ID**\***                                            |                                     |
| AUTH_PROVIDER_GITLAB_CLIENT_SECRET**\***                                        |                                     |
| AUTH_PROVIDER_GITLAB_BASE_URL                                                   |                                     |
| AUTH_PROVIDER_GITLAB_SCOPE                                                      | `read_user`                         |
| AUTH_PROVIDER_BITBUCKET_ENABLED                                                 | `false`                             |
| AUTH_PROVIDER_BITBUCKET_CLIENT_ID**\***                                         |                                     |
| AUTH_PROVIDER_BITBUCKET_CLIENT_SECRET**\***                                     |                                     |
| AUTH_PROVIDER_STRAVA_ENABLED                                                    | `false`                             |
| AUTH_PROVIDER_STRAVA_CLIENT_ID**\***                                            |                                     |
| AUTH_PROVIDER_STRAVA_CLIENT_SECRET**\***                                        |                                     |
| AUTH_PROVIDER_STRAVA_SCOPE                                                      | `profile:read_all`                  |
