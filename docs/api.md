# API

| Category                          | Endpoint                                                       | Description                               |
| --------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| [Authentication](#authentication) | [POST /register](#registration)                           | Account registration                      |
| ^^                                | [POST /login](#login)                                     | Login                                     |
| ^^                                | [POST /logout](#logout)                                   | Logout                                    |
| ^^                                | [GET /jwks](#jwks)                                        | JWK Set                                   |
| ^^                                | [POST /activate](#activate-account)                       | Activate account                          |
| ^^                                | [POST /resend-confirmation](#resend-confirmation)         | Resend Confirmation                       |
| ^^                                | [POST /delete](#delete-account)                           | Delete account                            |
| ^^                                | [POST /change-password/](#change-password)                | Change password                           |
| ^^                                | [POST /change-password/request](#change-password-request) | Request to change password password       |
| ^^                                | [POST /change-password/change](#change-password-change)   | Change password                           |
| ^^                                | [POST /change-email/](#)                                  | Change email (without email verification) |
| ^^                                | [POST /change-email/request](#)                           | Request email change                      |
| ^^                                | [POST /change-email/change](#)                            | Change email                              |
| ^^                                | [GET /token/refresh](#refresh-token)                      | Get new refresh token                     |
| ^^                                | [POST /token/revoke](#revoke-refresh-token)               | Revoke tokens                             |
| ^^                                | [POST /mfa/generate](#generate-mfa-qr-code)               | Generate MFA QR code                      |
| ^^                                | [POST /mfa/enable](#enable-mfa)                           | Enable MFA                                |
| ^^                                | [POST /mfa/disable](#disable-mfa)                         | Disable MFA                               |
| ^^                                | [POST /mfa/totp](#totp)                                   | TOTP                                      |
| [Storage](storage)                | [GET /storage/o/\<rule-path\>](#file)                          | Get file                                  |
| ^^                                | [GET /storage/m/\<rule-path\>](#file-metadata)                 | Get metadata of file                      |
| ^^                                | [GET /storage/o/\<rule-path\>/](#file-directory)               | Get zip of all files in directory         |
| ^^                                | [GET /storage/m/\<rule-path\>/](#file-directory-metadata)      | Get metadata of all files in direcotry    |
| ^^                                | [POST /storage/o/\<rule-path\>](#upload-file)                  | Upload a file                             |
| ^^                                | [DELETE /storage/o/\<rule-path\>](#delete-file)                | Delete a file                             |
| [Other](#other)                   | [GET /healthz](#health-check)                                  | Health Check                              |

## Authentication

### Registration

Register a new account.

#### Request

`POST /register`

```json
{
  "email": "hello@example.com",
  "password": "between MIN_PASSWORD_LENGTH-128 characters"
}
```

#### Response

```
204 No Content
```

---

### Login

Login an account.

#### Request

`POST /login`

```json
{
  "email": "hello@example.com",
  "password": "secretpassword"
}
```

#### Response

```json
{
  "mfa": false,
  "jwt_token": "...",
  "jwt_expires_in": 900000
}
```

If Multi Factor Authentication (MFA) is enabled for the account the following response body is returned:

```json
{
  "mfa": true,
  "ticket": "..."
}
```

For login with MFA, proceed authentication by requesting the [TOTP](#totp) `/mfa/totp` endpoint.

---

### Logout

Logout an account.

#### Request

`POST /logout`

```
<empty>
```

#### Response

```
204 No Content
```

---

### JWK

JWK. This endpoint is active if env var `JWT_ALGORITHM` is one of `['RS256', 'RS384', 'RS512']`.

#### Request

`GET /jwks`

```
<empty>
```

#### Response

```json
{
  "keys": [...]
}
```

---

### Activate account

Activate account. This endpoint is active if env var `AUTO_ACTIVATE_NEW_USERS=false` (default `true`).

#### Request

`GET /activate?ticket=<ticket>`

#### Response

```
204 No Content
```

---

### Resend Confirmation

Resend confirmation. This endpoint is active if env var `AUTO_ACTIVATE_NEW_USERS=false` (default `true`).

This can be called when the activate account token has expired and the user needs to request a new one so they can activate their account. This will update the user's token and resend the confirmation email.

#### Request

`POST /resend-confirmation`

```json
{ "email": "hello@example.com" }
```

#### Response

```json
{ jwt_token: null, jwt_expires_in: null, user }
```
---

### Delete Account

Delete account. This endpoint is active if env var `ALLOW_USER_SELF_DELETE=true` (default `false`).

#### Request

`POST /delete`

```
<empty>
```

#### Response

```
204 No Content
```

---

### Change password

Change password of an account. The account must be logged in for this endpoint to work.

#### Request

`POST /change-password/`

```json
{
  "old_password": "secretpassword",
  "new_password": "newsecretpassword"
}
```

#### Response

```
204 No Content
```

---

### Change Password Request

Request to change password. This endpoint is active if env var `LOST_PASSWORD_ENABLED=true`.

::: warning
This endpoint will always return HTTP status code 204 in order to not leak information about the database.
:::

#### Request

`POST /change-password/request`

```json
{
  "email": "hello@example.com"
}
```

#### Response

```
204 No Content
```

### Change Password Change

Change password based on a ticket. This endpoint is active if env var `LOST_PASSWORD_ENABLED=true`.

#### Request

`POST /change-password/change`

```json
{
  "ticket": "uuid",
  "new_password": "newsecretpassword"
}
```

#### Response

```
204 No Content
```

---

### Change Email

Change email without email verification as a logged in account. This endpoint is only active if env var `VERIFY_EMAILS=false` (default ``).

#### Request

`POST /change-email/`

```json
{
  "new_email": "new-hello@example.com"
}
```

#### Response

```
204 No Content
```

### Change Email Request

Send request for the new email that the account wants to change to. This endpoint is only active if `VERIFY_EMAILS=true`.

#### Request

`POST /change-email/request`

```json
{
  "new_email": "new-hello@example.com"
}
```

#### Response

```
204 No Content
```

### Change Email Change

Change email to the new email that you specified in [Change Email Request](#change-email-request). This endpoint is only active if `VERIFY_EMAILS=true`.

#### Request

`POST /change-email/change`

```json
{
  "ticket": "uuid-ticket"
}
```

#### Response

```
204 No Content
```

### Refresh token

Get new refresh token.

#### Request

`GET /token/refresh`

#### Response

```json
{
  "jwt_token": "token",
  "jwt_expires_in": 900000
}
```

---

### Revoke Refresh Token

Revoke a refresh token.

#### Request

`POST /token/revoke/`

#### Response

```
204 No Content
```

---

### Generate MFA QR code

#### Request

`POST /mfa/generate`

```
<empty>
```

#### Response

```json
{
  "image_url": "base64_data_image_of_qe_code",
  "otp_secret": "..."
}
```

### Enable MFA

Enable Multi Factor Authentication.

#### Request

`POST /mfa/enable`

```json
{
  "code": "892723"
}
```

#### Response

```
204 No Content
```

### Disable MFA

Disable Multi Facetor Authentication.

#### Request

`POST /mfa/disable`

```json
{
  "code": "code-from-mfa-client"
}
```

#### Response

```
204 No Content
```

### TOTP

Time-based One-time Password. Use the `ticket` from [Login](#login) that is returned if the account has activated MFA.

#### Request

`POST /mfa/totp`

```json
{
  "code": "code-from-mfa-client",
  "ticket": "uuid-ticket"
}
```

#### Response

```json
{
  "jwt_token": "jwt-token",
  "jwt_expires_in": 900000
}
```

## Storage

### File

Get file

#### Request

`GET /storage/o/<path-to-file>`

#### Image Transformation

Transform images on-the-fly using query parameters. Cache headers are sent with the image for browsers to cache the image client-side.

##### Example

`/storage/o/<path-to-file>?w=800&q=90`

##### Width

Specify width in pixels of the image. If no height (`h`) is specified, the image automatically calculates the height to keep the image's aspect ratio. The value has to be between 0 and 8192.

Query parameter: `w`.

##### Height

Specify the height of the image. If no width (`w`) is specified, the image automatically calculates the width to keep the image's aspect ratio. The value has to be between 0 and 8192.

Query parameter: `h`.

##### Quality

Specify the quality of the image with a value between 1 (very course) to 100 (lossless or almost lossless).

Query parameter: `q`.

##### Format

Specify the preferred format of the requested image.

This parameter can be one of the following values: `webp`, `png`, `jpeg`, `auto`. When the value is `auto` the image will be transformed to the `webp` format if the request header explicitly accepts `image/webp`, otherwise the default format will be returned.

Query parameter: `f`.

##### Rounding

Give the image rounded corners

Query parameter: `r`.

This parameter can be either an integer or `full` for when the image has to be fully rounded (e.g. an avatar).

##### Blur

Add a Gaussian blur to the image, the blur has to be between 0.3 and 1000.

Query parameter: `b`.

#### Response

```
<file>
```

---

### File metadata

Get file metadata.

#### Request

`GET /storage/m/<path-to-file>`

#### Response

```json
{
  "key": "<path-to-file>",
  "AcceptRanges": "bytes",
  "LastModified": "2020-01-01T01:02:03.000Z",
  "ContentLength": 12345,
  "ETag": "Etag",
  "ContentType": "<content-type>",
  "Metadata": {
    "token": "<auto-generated-access-token-uuid>"
  }
}
```

---

### File directory

Get zip of all files in directory.

#### Request

`GET /storage/o/<path-to-folder>/`

#### Response

```
Downloadable list.zip file
```

---

---

### File directory metadata

Get zip of all files in directory.

#### Request

`GET /storage/m/<path-to-folder>/`

#### Response

```json
[
  {
    "key": "<path-to-file>",
    "AcceptRanges": "bytes",
    "LastModified": "2020-01-01T01:02:03.000Z",
    "ContentLength": 12345,
    "ETag": "Etag",
    "ContentType": "<content-type>",
    "Metadata": {
      "token": "<auto-generated-access-token-uuid>"
    }
  },
  {
    "key": "<other-path-to-file>",
    "AcceptRanges": "bytes",
    "LastModified": "2020-05-04T03:02:01.000Z",
    "ContentLength": 54321,
    "ETag": "Etag",
    "ContentType": "<content-type>",
    "Metadata": {
      "token": "<auto-generated-access-token-uuid>"
    }
  }
]
```

---

### Upload file

Upload, or overwrite, a file.

#### Request

`POST /storage/o/<path-to-file>/`

#### Response

```json
{
  "key": "<path-to-file>",
  "AcceptRanges": "bytes",
  "LastModified": "2020-01-01T01:02:03.000Z",
  "ContentLength": 12345,
  "ETag": "Etag",
  "ContentType": "<content-type>",
  "Metadata": {
    "token": "<auto-generated-access-token-uuid>"
  }
}
```

---

### Delete file

Delete a file.

#### Request

`DELETE /storage/o/<path-to-file>/`

#### Response

```json
204 No Content
```

---

### Health Check

Simple health check.

#### Request

`GET /healthz`

#### Response

```
200 OK
```
