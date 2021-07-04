# Configuration

## General

<!-- TODO AUTH_ENABLED and STORAGE_ENABLED -->
<!-- TODO SERVER_URL, HOST, PORT -->
<!-- TODO REDIRECT_URL_SUCCESS, REDIRECT_URL_ERROR -->

## Connect to Hasura

In order to connect HBP to Hasura, you need to provide the Hasura GraphQL endpoint in the `HASURA_ENDPOINT` environment variable. Note that this should include the full path of the GraphQL endpoint, usually ending with `/v1/graphql`.
For example, in the [default docker-compose file of the HBP repository](https://github.com/nhost/hasura-auth/blob/main/docker-compose.yaml), `HASURA_ENDPOINT` equals `http://graphql-engine:8080/v1/graphql`.

You also need to provide a valid Hasura admin secret key in the `HASURA_GRAPHQL_ADMIN_SECRET` environment variable. Note that this variable is mandatory for HBP to work, i.e. HBP won't work if your Hasura instance is not secured with such an admin key. You can find further reading about admin secret keys in the [Hasura documentation](https://hasura.io/docs/1.0/graphql/manual/deployment/production-checklist.html#set-an-admin-secret).

The last point of attention is to make sure both HBP and Hasura are using the same JWT configuration: as HBP will generate the JWT used for authentication in Hasura, it is very important that JWT is configured in a way that Hasura understands it. You will find more information on how to configure JWT in HBP.

## Configure JWT

<!-- TODO - JWKS endpoint -->

## Migrations

::: warning
Before running migrations on any sort, it is HIGHLY recommended to make a backup of your database.
:::

To get HBP running correctly we must configure Hasura and PostgreSQL. This configurations is done using Hasura migrations and will add the correct database configuration and apply the correct Hasura metadata.

### Apply migrations for a new installation

For a complete new installation you can have Hasura apply the migrations automatically for you, using Docker. This is an example in docker-compose.

```yaml
graphql-engine:
  image: hasura/graphql-engine:v1.2.1.cli-migrations-v2
  depends_on:
    - 'postgres'
  restart: always
  env_file: .env
  ports:
    - '8080:8080'
  volumes:
    - [path-to]/hasura-auth/migrations:/hasura-migrations
    - [path-to]/hasura-auth/metadata:/hasura-metadata
```

### Migrating from HBP v1

Hasura Backend Plus v2 introduces some brand new features, coming with some breaking changes:

- While all the former v1 features exist in v2, the [API endpoints](api) have been modified, and some may behave slightly differently. You may need to change your frontend applications accordingly.
- The Storage module have been completely rewritten. <!-- TODO link to storage -->
- The refresh token is now stored in an [HTTP cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) <!-- TODO link to refresh token / cookies system -->

To upgrade from v1 to v2:

::: tip
We'll be using the [Hasura CLI](https://hasura.io/docs/1.0/graphql/manual/hasura-cli/index.html). Make sure it's installed on your computer.
:::

::: tip
All user and account data will be copied to the new v2 schema and work out of the box.
:::

1. Make sure you have backed up your database!

2. Download HBP locally and change directory

```sh
git clone git@github.com:nhost/hasura-auth.git
cd hasura-auth
```

3. Create empty `config.yaml` file.

```sh
touch config.yaml
```

4. Re order the directories so we'll be using the `migrations-v1` directory.

```sh
rm -rf migrations
mv migrations-v1 migrations
```

5. Apply migrations

Note: `[endpoint]` should not include `/v1/graphql`.

```sh
hasura migrate apply --endpoint=[endpoint] --admin-secret=[admin-secret]
```

6. Clean up

```sh
cd ..
rm -rf hasura-auth
```

You have now migrated from HBP v1 to HBP v2 schema. You can no start using HBP v2!

### Experimental

HBP can apply migrations automatically on startup. Both from a zero to version 2. And from version 1 to version 2. However, this is a experimental feature and it's not recommended to be used in production since it could lead to unwanted side effects.

::: tip
The HBP migration system relies on [Hasura CLI](https://hasura.io/docs/1.0/graphql/manual/hasura-cli/index.html) and uses a [v1 migrations/metadata configuration](https://hasura.io/docs/1.0/graphql/manual/migrations/config-v1/index.html), as the config v2 doesn't allow metadata incremental change (yet?).
:::

By default, HBP does not checks when starting if its schema is already present in the database. If not, it runs the necessary SQL migrations and loads the related Hasura metadata, while keeping the existing database and Hasura metadata unchanged.

<!-- TODO link to the database schema -->

You can disable this automatic check and migration system by setting `AUTO_MIGRATE=false`.

If you want to upgrading HBP v1 to v2, you can set `AUTO_MIGRATE=v1` and restart HBP. HBP will then upgrade the database and Hasura for HBPv2. All user and account data will be placed correctly in the new v2 schema.

## Registration

### Activate accounts

By default, accounts are automatically activated on registration. You may want to change this so you add a step to the registration process.

To deactivate autoactivation, set the environment variable `AUTO_ACTIVATE_NEW_USERS=false`

In addition to this, you can send a verification email with an activation link. You will then need to [configure the connection to a SMTP server](#enable-emails).

If SMTP is enabled, then the user will receive an email with an activation link. If the activation succeeds, the user is redirected to the url found in the `REDIRECT_URL_SUCCESS` environment variable. If it fails, they will redirected to the url given by the `REDIRECT_URL_ERROR` environment variable.

You can change the default email templates. In order to do so, you can mount [custom configuration files](#custom-configuration-files) when using docker, or change files in the [custom directory](https://github.com/nhost/hasura-auth/tree/main/custom) when running HBP from the source code.
Other email templates are available and described [here](#email-templates)

### Limit email domains

You can limit registration to ranges of emails that are only part of an whitelist. For instance, you may want to limit registration only to the email addresses of your own organisation. You can pass a list of comma-separated email domains to the `ALLOWED_EMAIL_DOMAINS` environment variable, for instance:

```
ALLOWED_EMAIL_DOMAINS=gmail.com,yourorganisation.com
```

### Password constraints

By default, clients can register with a password of at least three characters. You can change this in setting a higher value:

```
MIN_PASSWORD_LENGTH=6
```

You can ask HBP to check on [Have I Been Pwned](https://haveibeenpwned.com/Passwords) if the password has been previously exposed in data breaches. If so, the registration will fail. This option is disabled by default. You can change it to:

```
HIBP_ENABLED=true
```

### Additional registration fields

You may want to extend the `public.users` table with your own fields and relations, and to expect the client to set some of them when registering. It is possible to set a list of columns in the `REGISTRATION_CUSTOM_FIELDS` environment value.

<!-- TODO link to the page on schema -->

Here is an example on the way to proceed to add a `nickname` value to the registration:

1. Add a column `nickname` of type text to the `public.users` table
2. Set the environment variable `REGISTRATION_CUSTOM_FIELDS=nickname`
3. The registration endpoint now expects a `user_data` value in addition to `email` and `password` that has `{"nickname": "Some Nickname"}`

::: warning
Any given field must exist in the `users` GraphQL type that corresponds to the `public.users` PostgreSQL table, or registration will fail.
:::

<!-- TODO link to JWT custom claims -->

## Authentication

### OAuth Providers

### Two-factor Authentication

## Enable emails

## Custom configuration files

<!-- TODO explain the contents of the configuration files, and how to mount them with a docker volume -->

### Storage Rules

File authorization is tricky to manage, and means developers need to spend a lot of time on authentication and authorization. Using Hasura Backend Plus means all this complex code is done for you! All you need to do is set out file access rules, which makes creating and updating rules easy to manage.

The rules are set in a `yaml` file, and let you control granular access to files and folders. Hasura Backend Plus comes with a [rules template](https://github.com/nhost/hasura-auth/blob/main/custom/storage-rules/rules.yaml), which you can change for your specific project:

```yaml
functions:
  isAuthenticated: 'return !!request.auth'
  isOwner: "return !!request.auth && userId === request.auth['user-id']"
  validToken: 'return request.query.token === resource.Metadata.token'
paths:
  /user/:userId/:
    list: 'isOwner(userId)'
  /user/:userId/:fileId:
    read: 'isOwner(userId) || validToken()'
    write: 'isOwner(userId)'
```

The `yaml` file is split into the following sections:

- [Paths](#paths)
- [Storage functions](#storage-functions)

---

#### Paths

Paths allow you to define authorization permissions to your folders and files. This means you can control access to files, folders, and subfolders easily.

Paths can be static or dynamic, and dynamic paths can be used as variables within storage functions.

##### Folder paths

Folder paths

```yaml
paths:
  /user/:userId/files/:
    # Rules
```

**Note the trailing slash**. This is how you define folder paths.

You can use this to add permissions to listing files in a directory or downloading a `.zip` file of all the files.

##### File paths

File paths define rules for the individual files within your storage.

```yaml
paths:
  /user/:userId/files/:fileId:
    # Rules
```

Here, the `/user` and `/files` parts are static paths. The `:userId` and `:fileId` parts are dynamic paths.

Here's an example path that would be validated by this rule:

```txt
/user/1/files/image.png
```

#### Rules

You can specify the following rules in your `rules.yaml` file:

| Action           | Metadata (`/m/`)                  | Object (`/o/`)                        |
| ---------------- | --------------------------------- | ------------------------------------- |
| Folder: `create` | N/A                               | N/A                                   |
| Folder: `update` | N/A                               | N/A                                   |
| Folder: `list`   | Get metadata for accessible files | Get `.zip` folder of accessible files |
| Folder: `get`    | N/A                               | N/A                                   |
| Folder: `delete` | N/A                               | N/A                                   |
| &nbsp;           |                                   |                                       |
| File: `create`   | N/A                               | Create file                           |
| File: `update`   | Update metadata                   | Update file                           |
| File: `list`     | N/A                               | N/A                                   |
| File: `get`      | Get file metadata                 | Get file                              |
| File: `delete`   | N/A                               | Delete the file                       |

For simple allow/deny, you can return boolean values (`true`/`false`) in a string.

```yaml
paths:
  /public:
    list: 'true'
  /private:
    list: 'false'
```

For any complex permissions using variables, you should use [storage functions](#storage-functions).

##### File tokens

When you upload a file to Hasura Backend Plus, a token is automatically added to the file metadata. This is unique for the file, and can be used as an access token.
You can create a `validToken` storage function, and use that to allow access to the file, even if a user is unauthenticated.

We can define a rule to allow access to this image if the right token (in this case `c9aa7344-1b4c-42d2-81c0-48ee401a3eeb`) is present:

```txt
/storage/o/private/secret-image.jpg?token=c9aa7344-1b4c-42d2-81c0-48ee401a3eeb
```

The token is sent as a query parameter, which you can access on the `request` object. You can check the token against the `resource.Metadata.token` variable:

```yaml
functions:
  validToken: 'return request.query.token === resource.Metadata.token'
```

You can now use the `validToken` storage function to allow anyone to see the file with the correct token:

```yaml
functions:
  validToken: 'return request.query.token === resource.Metadata.token'
paths:
  /private/:fileId:
    read: 'validToken()'
```

#### Storage functions

> It is not possible to call storage functions inside other functions

Storage functions allow you to define permissions which can be used by any rules. Storage functions have access to the query string of the request, and the permission variables returned by the [login](../api.md#login) or [refresh](../api.md#refresh-token) endpoints.

You can have a look at the permission variables by examining the `permissionVariables`. This is a URL-encoded string, in the following template:

```txt
s:<request.auth>.<checksum>
```

The `request.auth` part is a JSON object, which is the same as the [Hasura permission variables](https://hasura.io/docs/1.0/graphql/manual/authentication/index.html#overview) but with the `x-hasura-` prefix removed:

```json
{
  "user-id": "73f5d02c-484a-4003-98e4-bad5c6001882",
  "allowed-roles": ["user"],
  "default-role": "user"
}
```

You can access these variables through `request.auth` (for example `request.auth['default-role']`) when creating your storage rules.

A simple storage function would be to test if a user is authenticated. You can do this by checking if `request.auth` is present:

```yaml
functions:
  isAuthenticated: 'return !!request.auth'
```

Now, you can use this storage function within a storage path:

```yaml
functions:
  isAuthenticated: 'return !!request.auth'
paths:
  /everyone/:
    list: 'isAuthenticated()
```

This will allow any logged-in user to access the files in the `/everyone/` directory. If someone isn't logged in, they won't be able to see them.

You can also add more complex rules. For example, if you would like to allow users to access files within a folder named as their user id, you can add the following storage function:

```yaml
functions:
  isOwner: 'return !!request.auth && request.auth["user-id"] === userId'
```

This function checks that a user is logged in, but also uses a variable called `userId`, which must be passed in by the rule from a [dynamic path](#folder-paths):

```yaml
functions:
  isOwner: 'return !!request.auth && request.auth["user-id"] === userId'
paths:
  /:userId/:
    list: 'isOwner(userId)'
  /:userId/:fileId:
    read: 'isOwner(userId)'
```

This rule will allow users to list their own file directory, and read their own files.

#### Adding variables

Say you have many users that belong to different companies. You need to allow users to see files belonging to their own company, but not files belonging to other companies.

You will need a `company_id` column on your `users` table, and from this we can add appropriate permissions.

First, you need to add this column to the authentication permission variables, so that the `request.auth` now contains this variable:

```json
{
  "user-id": "73f5d02c-484a-4003-98e4-bad5c6001882",
  "allowed-roles": ["user"],
  "default-role": "user",
  "company-id": "e04567bf-884d-46f0-898e-bac1a260e128"
}
```

Now, you can add the following storage functions to your `rules.yaml`:

```yaml
functions:
  employedBy: 'return !!request.auth && request.auth["company-id"] === companyId'
paths:
  /:companyId/:
    list: 'employedBy(companyId)'
  /:companyId/:fileId:
    read: 'employedBy(companyId) && validToken()'
    write: 'employedBy(companyId)'
```

How does this work? The `:companyId` path creates a variable called `companyId`, which can be passed into a function.
This gets passed into the `employedBy()` function, (called `companyId`), and can be compared to `request.auth['company-id']` from the `permissionVariables`.

### Email templates

### Private key

## Custom User Schema

## Rate limiting

<!-- TODO MAX_REQUESTS, TIME_FRAME, healthz -->

## Environment Variables

### General

| Name                          | Default | Description                                                                                                                                                  |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                    |         |                                                                                                                                                              |
| `LOG_LEVEL`                   | INFO    | Piped to the Hasura CLI when applying migrations/metadata. Allowed values [here](https://hasura.io/docs/latest/graphql/core/hasura-cli/hasura.html#options). |
| `APP_NAME`                    |         | Application's name. Used on emails **Required**                                                                                                              |
| `HASURA_ENDPOINT` (required)  |         | Url of the Hasura GraphQL engine endpoint used by the backend to access the database.                                                                        |
| `HASURA_GRAPHQL_ADMIN_SECRET` |         | The secret set in the Hasura GraphQL Engine to allow admin access to the service. **Strongly recommended**.                                                  |
| `HOST`                        |         | Listening host of the service                                                                                                                                |
| `PORT`                        | 3000    | Port of the service                                                                                                                                          |
| `SERVER_URL`                  |         | Current server URL. Currently used only for creating links from email templates                                                                              |
| `APP_URL`                     |         | Current app URL. Currently used only for creating links from email templates                                                                                 |
| `MAX_REQUESTS`                | 100     | Maximum requests per IP within the following `TIME_FRAME`.                                                                                                   |
| `TIME_FRAME`                  | 900000  | Timeframe used to limit requests from the same IP, in milliseconds. Defaults to 15 minutes.                                                                  |

### Authentication

| Name                         | Default                 | Description                                                                                                                                                                                  |
| ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_LOCAL_USERS_ENABLED`   | true                    | Enable local users (email/pw) to register and login                                                                                                                                          |
| `ANONYMOUS_USERS_ENABLED`    | false                   |                                                                                                                                                                                              |
| `DEFAULT_ANONYMOUS_ROLE`     |                         |                                                                                                                                                                                              |
| `ALLOWED_EMAIL_DOMAINS`      |                         | List of comma-separated email domain names that are allowed to register.                                                                                                                     |
| `CHANGE_EMAIL_ENABLED`       |                         |                                                                                                                                                                                              |
| `AUTO_ACTIVATE_NEW_USERS`    | true                    | When set to true, automatically activate the users once registererd.                                                                                                                         |
| `DEFAULT_USER_ROLE`          | user                    |                                                                                                                                                                                              |
| `DEFAULT_ALLOWED_USER_ROLES` | user                    | Comma spearated list of default allowed roles assigned to each user. Defaults to DEFAULT_USER_ROLE.                                                                                          |
| `ALLOWED_USER_ROLES`         | user                    | Comma spearated list of allowed roles users can specify on registration. Defaults to DEFAULT_ALLOWED_USER_ROLES.                                                                             |
| `HIBP_ENABLED`               | false                   |                                                                                                                                                                                              |
| `JWT_ALGORITHM`              | RS256                   | Valid values: RS256, RS384, RS512, HS256, HS384, HS512                                                                                                                                       |
| `JWT_KEY`                    |                         | Encryption secret. Required when using a SHA (RS*) algorithm. When using a RSA algorithm (RS*), should contain a valid RSA PEM key, otherwise `JWT_KEY_FILE_PATH` will be used.              |
| `JWT_EXPIRES_IN`             | 15                      |                                                                                                                                                                                              |
| `JWT_KEY_FILE_PATH`          | keys/private.pem | Path to the RSA PEM private key file when using a RSA (RS\*) algorithm and no `JWT_KEY` is set. When used, will create a random key if the file is not found.                                |
| `JWT_CLAIMS_NAMESPACE`       |                         |                                                                                                                                                                                              |
| `MIN_PASSWORD_LENGTH`        | 3                       | Minimum allowed password length.                                                                                                                                                             |
| `REDIRECT_URL_ERROR`         |                         |                                                                                                                                                                                              |
| `REDIRECT_URL_SUCCESS`       |                         |                                                                                                                                                                                              |
| `VERIFY_EMAILS`              | false                   | Enable verification emails                                                                                                                                                                   |
| `JWT_REFRESH_EXPIRES_IN`     | 43200                   |                                                                                                                                                                                              |
| `EMAILS_ENABLED`             | false                   | When set to true, emails are sent on certain steps, like after registration for account activation when autoactivation is deactivated, or for changing emails or passwords                   |
| `EMAILS_DEFAULT_LOCALE`      | en                      |
| `SMTP_HOST`                  |                         | SMTP server path to use for sending emails.                                                                                                                                                  |
| `SMTP_PASS`                  |                         | Password to authenticate on the SMTP server.                                                                                                                                                 |
| `SMTP_USER`                  |                         | Username to authenticate on the SMTP server.                                                                                                                                                 |
| `SMTP_PORT`                  | 587                     | SMTP server port.                                                                                                                                                                            |
| `SMTP_SECURE`                | false                   | Set to true when the SMTP uses SSL.                                                                                                                                                          |
| `SMTP_AUTH_METHOD`           |                         |                                                                                                                                                                                              |
| `SMTP_SENDER`                |                         |                                                                                                                                                                                              |
| `NOTIFY_EMAIL_CHANGE`        |                         |                                                                                                                                                                                              |
| `REGISTRATION_CUSTOM_FIELDS` |                         | Fields that need to be passed on to the registration patload, and that correspond to columns of the `public.users`table.                                                                     |
| `JWT_CUSTOM_FIELDS`          |                         | List of comma-separated column names from the `public.users` tables that will be added to the `https://hasura.io/jwt/claims`JWT claims. Column names are kebab-cased and prefixed with `x-`. |
| `OTP_ISSUER`                 | HBP                     | One-Time Password issuer name used with Muti-factor authentication.                                                                                                                          |
| `MFA_ENABLE`                 | false                   |                                                                                                                                                                                              |
| `USER_IMPERSONATION_ENABLE`  | false                   | Allow user impersonsation via setting `x-admin-secret` header on `/login`                                                                                                               |
| `MAGIC_LINK_ENABLE`          | false                   |
| `WHITELIST_ENABLED`          | false                   |
| `ADMIN_ONLY_REGISTRATION`    | false                   | Allow registration only with x-admin-secret

### Gravatar

| Name                         | Default | Description |
| ---------------------------- | ------- | ----------- |
| `GRAVATER_ENABLED`           | true    |             |
| `GRAVATAR_DEFAULT`           | blank   |             |
| `GRAVATAR_RATING`            | g       |             |

### Providers

| Name                         | Default                               | Description |
| ---------------------------- | ------------------------------------- | ----------- |
| `PROVIDER_SUCCESS_REDIRECT`  |                                       |             |
| `PROVIDER_FAILURE_REDIRECT`  |                                       |             |
| `GOOGLE_ENABLED`             | false                                 |             |
| `GOOGLE_CLIENT_ID`           |                                       |             |
| `GOOGLE_CLIENT_SECRET`       |                                       |             |
| `GOOGLE_SCOPE`               | email,profile                         |             |
| `FACEBOOK_ENABLED`           | false                                 |             |
| `FACEBOOK_CLIENT_ID`         |                                       |             |
| `FACEBOOK_CLIENT_SECRET`     |                                       |             |
| `FACEBOOK_PROFILE_FIELDS`    | email,photos,displayName              |             |
| `TWITTER_ENABLED`            | false                                 |             |
| `TWITTER_CONSUMER_KEY`       |                                       |             |
| `TWITTER_CONSUMER_SECRET`    |                                       |             |
| `LINKEDIN_ENABLED`           | false                                 |             |
| `LINKEDIN_CLIENT_ID`         |                                       |             |
| `LINKEDIN_CLIENT_SECRET`     |                                       |             |
| `LINKEDIN_SCOPE`             | r_emailaddress,r_liteprofile          |             |
| `APPLE_ENABLED`              | false                                 |             |
| `APPLE_CLIENT_ID`            |                                       |             |
| `APPLE_KEY_ID`               |                                       |             |
| `APPLE_PRIVATE_KEY`          |                                       |             |
| `APPLE_TEAM_ID`              |                                       |             |
| `APPLE_SCOPE`                | name,email                            |             |
| `GITHUB_ENABLED`             | false                                 |             |
| `GITHUB_AUTHORIZATION_URL`   |                                       |             |
| `GITHUB_CLIENT_ID`           |                                       |             |
| `GITHUB_CLIENT_SECRET`       |                                       |             |
| `GITHUB_TOKEN_URL`           |                                       |             |
| `GITHUB_USER_PROFILE_URL`    |                                       |             |
| `GITHUB_SCOPE`               | user:email                            |             |
| `WINDOWS_LIVE_ENABLED`       | false                                 |             |
| `WINDOWS_LIVE_CLIENT_ID`     |                                       |             |
| `WINDOWS_LIVE_CLIENT_SECRET` |                                       |             |
| `WINDOWS_LIVE_SCOPE`         | wl.basic,wl.emails,wl.contacts_emails |             |
| `SPOTIFY_ENABLED`            | false                                 |             |
| `SPOTIFY_CLIENT_ID`          |                                       |             |
| `SPOTIFY_CLIENT_SECRET`      |                                       |             |
| `SPOTIFY_SCOPE`              | user-read-email,user-read-private     |             |
| `GITLAB_ENABLED`             | false                                 |             |
| `GITLAB_CLIENT_ID`           |                                       |             |
| `GITLAB_CLIENT_SECRET`       |                                       |             |
| `GITLAB_BASE_URL`            |                                       |             |
| `GITLAB_SCOPE`               | read_user                             |             |
| `BITBUCKET_ENABLED`          | false                                 |             |
| `BITBUCKET_CLIENT_ID`        |                                       |             |
| `BITBUCKET_CLIENT_SECRET`    |                                       |             |
| `STRAVA_ENABLE`              | false                                 |             |
| `STRAVA_CLIENT_ID`           |                                       |             |
| `STRAVA_CLIENT_SECRET`       |                                       |             |
| `STRAVA_SCOPE`               | profile:read_all                      |             |
### Storage

| Name                   | Default | Description |
| ---------------------- | ------- | ----------- |
| `S3_ENDPOINT`          |         |             |
| `S3_BUCKET`            |         |             |
| `S3_ACCESS_KEY_ID`     |         |             |
| `S3_SECRET_ACCESS_KEY` |         |             |
| `S3_SSL_ENABLEDD`      | true    |             |
| `OBJECT_PREFIX`        | /o      |             |
| `META_PREFIX`          | /m      |             |
