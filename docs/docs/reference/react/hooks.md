---
title: 'Hooks'
sidebar_position: 2
---

## Authentication Hooks

### Email and Password Sign-Up

```js
const {
  signUpEmailPassword,
  isLoading,
  isSuccess,
  needsEmailVerification,
  isError,
  error,
} = useSignUpEmailPassword(/* options?: Options */);
```

| Name                     | Type                                                     | Notes                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signUpEmailPassword`    | (email?: string, password?: string) => void              | Used for a new user to sign up. Returns a promise with the current context                                                                                                                                        |
| `isLoading`              | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution.                                                                                                                              |
| `needsEmailVerification` | boolean                                                  | Returns `true` if the sign-up has been accepted, but a verificaiton email has been sent and is awaiting.                                                                                                          |
| `isSuccess`              | boolean                                                  | Returns `true` if the sign-up suceeded. Returns `false` if the new email needs to be verified first, or if an error occurred.                                                                                     |
| `isError`                | boolean                                                  | Returns `true` if an error occurred.                                                                                                                                                                              |
| `error`                  | {status: number, error: string, message: string} \| null | Provides details about the error.                                                                                                                                                                                 |
| `user`                   | User \| null                                             | User information                                                                                                                                                                                                  |
| `accessToken`            | string \| null                                           | Access token (JWT)                                                                                                                                                                                                |
| `options.locale`         | string \| undefined                                      | Locale of the user, in two digits, for instance `en`.                                                                                                                                                             |
| `options.allowedRoles`   | string[] \| undefined                                    | Allowed roles of the user. Must be a subset of the default allowed roles defined in Hasura Auth.                                                                                                                  |
| `options.defaultRole`    | string \| undefined                                      | Default role of the user. Must be part of the default allowed roles defined in Hasura Auth.                                                                                                                       |
| `options.displayName`    | string \| undefined                                      |                                                                                                                                                                                                                   |
| `options.metadata`       | Record<string, unknown> \| undefined                     | Custom additional user information stored in the `metadata` column. Can be any JSON object.                                                                                                                       |
| `options.redirectTo`     | string \| undefined                                      | redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```jsx
import { useState } from 'react';
import { useSignUpEmailPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignUpEmailPassword();

  return (
    <div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      <button onClick={() => signUpEmailPassword(email, password)}>
        Register
      </button>
      {isSuccess && (
        <div>Your account have beed created! You are now authenticated</div>
      )}
      {needsEmailVerification && (
        <div>
          Please check your mailbox and follow the verification link to verify
          your email
        </div>
      )}
    </div>
  );
};
```

### Email and Password Sign-In

```js
const {
  signInEmailPassword,
  isLoading,
  needsEmailVerification,
  needsMfaOtp,
  sendMfaOtp,
  isSuccess,
  isError,
  error,
  user,
} = useSignInEmailPassword();
```

| Name                     | Type                                                     | Notes                                                                                                                                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `signInEmailPassword`    | (email?: string, password?: string)                      | Will try to authenticate. Returns a promise with the current context                                                                        |
| `isLoading`              | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution.                                                        |
| `needsEmailVerification` | boolean                                                  | Returns `true` if the user email is still pending email verification.                                                                       |
| `needsMfaOtp`            | boolean                                                  | Returns `true` if the server is awaiting an MFA one-time password to complete the authentication.                                           |
| `sendMfaOtp`             | (otp: string) => void                                    | Sends MFA One-time password. Will turn either `isSuccess` or `isError` to true, and store potential error in `error`.                       |
| `isSuccess`              | boolean                                                  | Returns `true` if the user has successfully authenticated. Returns `false` in case or error or if the new email needs to be verified first. |
| `isError`                | boolean                                                  | Returns `true` if an error occurred.                                                                                                        |
| `error`                  | {status: number, error: string, message: string} \| null | Provides details about the error.                                                                                                           |
| `user`                   | User \| null                                             | User information                                                                                                                            |
| `accessToken`            | string \| null                                           | Access token (JWT)                                                                                                                          |

#### Usage

```jsx
import { useState } from 'react';
import { useSignInEmailPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    signInEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignInEmailPassword();

  return (
    <div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      <button onClick={() => signInEmailPassword(email, password)}>
        Register
      </button>
      {isSuccess && <div>Authentication suceeded</div>}
      {needsEmailVerification && (
        <div>
          You must verify your email to sign in. Check your mailbox and follow
          the instructions to verify your email.
        </div>
      )}
    </div>
  );
};
```

### Oauth Providers

```js
const providerLink = useProviderLink(/* options?: Options */);
```

| Name                   | Type                                 | Notes                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options.locale`       | string \| undefined                  | Locale of the user, in two digits, for instance `en`.                                                                                                                                                             |
| `options.allowedRoles` | string[] \| undefined                | Allowed roles of the user. Must be a subset of the default allowed roles defined in Hasua Auth.                                                                                                                   |
| `options.defaultRole`  | string \| undefined                  | Default role of the user. Must be part of the default allowed roles defined in Hasura Auth.                                                                                                                       |
| `options.displayName`  | string \| undefined                  |
| `options.metadata`     | Record<string, unknown> \| undefined | Custom additional user information stored in the `metadata` column. Can be any JSON object.                                                                                                                       |
| `options.redirectTo`   | string \| undefined                  | Redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```js
import { useProviderLink } from '@nhost/react';

const Component = () => {
  const { facebook, github } = useProviderLink();

  return (
    <div>
      <a href={facebook}>Authenticate with Facebook</a>
      <a href={github}>Authenticate with GitHub</a>
    </div>
  );
};
```

### Passwordless email authentication

```js
const { signInEmailPasswordless, isLoading, isSuccess, isError, error } =
  useSignInEmailPasswordless(/* options?: Options */);
```

| Name                      | Type                                             | Notes                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signInEmailPasswordless` | (email?: string) => void                         | Sends a magic link to the given email.                                                                                                                                                                            |
| `isLoading`               | boolean                                          | Returns `true` when the action is executing, `false` when it finished its execution.                                                                                                                              |
| `isSuccess`               | boolean                                          | Returns `true` if the magic link email user has successfully send.                                                                                                                                                |
| `isError`                 | boolean                                          | Returns `true` if an error occurred.                                                                                                                                                                              |
| `error`                   | {status: number, error: string, message: string} | Provides details about the error.                                                                                                                                                                                 |
| `options.locale`          | string \| undefined                              | Locale of the user, in two digits, for instance `en`.                                                                                                                                                             |
| `options.allowedRoles`    | string[] \| undefined                            | Allowed roles of the user. Must be a subset of the default allowed roles defined in Hasua Auth.                                                                                                                   |
| `options.defaultRole`     | string \| undefined                              | Default role of the user. Must be part of the default allowed roles defined in Hasura Auth.                                                                                                                       |
| `options.displayName`     | string \| undefined                              |
| `options.metadata`        | Record<string, unknown> \| undefined             | Custom additional user information stored in the `metadata` column. Can be any JSON object.                                                                                                                       |
| `options.redirectTo`      | string \| undefined                              | Redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```jsx
import { useState } from 'react';
import { useSignInEmailPasswordless } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { signInEmailPasswordless, isLoading, isSuccess, isError, error } =
    useSignInEmailPasswordless();

  return (
    <div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <button onClick={() => signInEmailPasswordless(email)}>
        Authenticate
      </button>
      {isSuccess && (
        <div>
          An email has been sent to {email}. Please check your mailbox and click
          on the authentication link.
        </div>
      )}
    </div>
  );
};
```

### Sign Out

The `useSignOut` hook accepts an `all` argument that will be used when the `signOut` method will be called. This value can be overriden in calling `signOut(allValue)`.

```js
const { signOut, isSuccess } = useSignOut(/* all: boolean */);
```

| Name        | Type                    | Notes                                                                                                                                                                                                                        |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signOut`   | (all?: boolean) => void | Will log the current user out. If `all` is set to true, it will deactivate the active session from all other devices. The `all` argument will take precedence over the the possible state value used when creating the hook. |
| `isSuccess` | boolean                 | Returns `true` when the user has successfully signed out.                                                                                                                                                                    |

#### Usage

```jsx
import { useState } from 'react';
import { useSignOut, useAuthenticated } from '@nhost/react';

const Component = () => {
  const { signOut, isSuccess } = useSignOut();
  const authenticated = useAuthenticated();

  if (authenticated) {
    return (
      <div>
        <button onClick={signUp}>Sign Out</button>
        {isSuccess && <div>You have successfully signed out!</div>}
      </div>
    );
  }

  return <div>Not authenticated</div>;
};
```

---

## Authentication status

### `useAuthenticationStatus`

The Nhost client may need some initial steps to determine the authentication status during startup, like fetching a new JWT from an existing refresh token.

`isLoading` will return `true` until the authentication status is known.

#### Usage

```jsx
import { useAuthenticationStatus } from '@nhost/react';

const Component = () => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus();
  if (isLoading) {
    return <div>Loading Nhost authentication status...</div>;
  }

  if (isAuthenticated) {
    return <div>User is authenticated</div>;
  }

  return <div>Public section</div>;
};
```

### Get the JWT access token

<!-- TODO ellaborate -->

```js
const accessToken = useAccessToken();
```

---

## User management

### Change email

```js
const { changeEmail, isLoading, needsEmailVerification, isError, error } =
  useChangeEmail(/* options?: { redirectTo?: string } */);
```

| Name                     | Type                                                     | Notes                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changeEmail`            | (email?: string) => void                                 | Requests the email change. Returns a promise with the current context                                                                                                                                             |
| `isLoading`              | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution.                                                                                                                              |
| `needsEmailVerification` | boolean                                                  | Returns `true` if the email change has been requested, but that a email has been sent to the user to verify the new email.                                                                                        |
| `isError`                | boolean                                                  | Returns `true` if an error occurred.                                                                                                                                                                              |
| `error`                  | {status: number, error: string, message: string} \| null | Provides details about the error.                                                                                                                                                                                 |
| `redirectTo`             | string \| undefined                                      | Redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```jsx
import { useState } from 'react';
import { useChangeEmail } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { changeEmail, isLoading, needsEmailVerification, isError, error } =
    useChangeEmail();

  return (
    <div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <button onClick={() => changeEmail(email)}>Change email</button>
      {needsEmailVerification && (
        <div>
          Please check your mailbox and follow the verification link to confirm
          your new email
        </div>
      )}
    </div>
  );
};
```

### Change password

```js
const { changePassword, isLoading, isSuccess, isError, error } =
  useChangePassword();
```

| Name             | Type                                                     | Notes                                                                                |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `changePassword` | (password?: string)                                      | Requests the password change. Returns a promise with the current context             |
| `isLoading`      | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution. |
| `isSuccess`      | boolean                                                  | Returns `true` if the password has beed successfully changed.                        |
| `isError`        | boolean                                                  | Returns `true` if an error occurred.                                                 |
| `error`          | {status: number, error: string, message: string} \| null | Provides details about the error.                                                    |

#### Usage

```jsx
import { useState } from 'react';
import { useChangePassword } from '@nhost/react';

const Component = () => {
  const [password, setPassword] = useState('');
  const { changePassword, isLoading, isSuccess, isError, error } =
    useChangePassword();

  return (
    <div>
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button onClick={() => changePassword(password)}>Change password</button>
    </div>
  );
};
```

### Reset password

If a user loses their password, we can resend them an email to authenticate so that they can change it to a new one:

```js
const { resetPassword, isLoading, isSent, isError, error } =
  useResetPassword(/* options?: { redirectTo?: string } */);
```

| Name            | Type                                                     | Notes                                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resetPassword` | (email?: string)                                         | Sends an email with a temporary connection link. Returns a promise with the current context                                                                                                                       |
| `isLoading`     | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution.                                                                                                                              |
| `isSent`        | boolean                                                  | Returns `true` when the email has been successfully sent.                                                                                                                                                         |
| `isError`       | boolean                                                  | Returns `true` if an error occurred.                                                                                                                                                                              |
| `error`         | {status: number, error: string, message: string} \| null | Provides details about the error.                                                                                                                                                                                 |
| `redirectTo`    | string \| undefined                                      | Redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```jsx
import { useState } from 'react';
import { useResetPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { resetPassword, isLoading, isSent, isError, error } =
    useResetPassword();

  return (
    <div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <button onClick={() => resetPassword(email)}>Send reset link</button>
    </div>
  );
};
```

### Send email verification

```js
const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail(/* options?: { redirectTo?: string } */);
```

| Name         | Type                                                     | Notes                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sendEmail`  | (email?: string)                                         | Resend the verification email. Returns a promise with the current context                                                                                                                                         |
| `isLoading`  | boolean                                                  | Returns `true` when the action is executing, `false` when it finished its execution.                                                                                                                              |
| `isSent`     | boolean                                                  | Returns `true` if the verification email has been sent                                                                                                                                                            |
| `isError`    | boolean                                                  | Returns `true` if an error occurred.                                                                                                                                                                              |
| `error`      | {status: number, error: string, message: string} \| null | Provides details about the error.                                                                                                                                                                                 |
| `redirectTo` | string \| undefined                                      | Redirection path in the client application that will be used in the link in the verification email. For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`. |

#### Usage

```jsx
import { useState } from 'react';
import { useSendVerificationEmail } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { sendEmail, isLoading, isSent, isError, error } =
    useSendVerificationEmail();

  return (
    <div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <button onClick={() => sendEmail(email)}>Send email verification</button>
      {isSent && (
        <div>
          Please check your mailbox and follow the verification link to confirm
          your email
        </div>
      )}
    </div>
  );
};
```

---

## User data

```js
const {
  id,
  email,
  displayName,
  avatarUrl,
  isAnonymous,
  locale,
  defaultRole,
  roles,
  metadata,
  createdAt,
} = useUserData();
```

| Name          | Type        | Default          | Notes                                           |
| ------------- | ----------- | ---------------- | ----------------------------------------------- |
| `id`          | string      |                  | User's unique identifier (uuid)                 |
| `email`       | string      |                  | User's email address                            |
| `displayName` | string      | `""`             | User's display name                             |
| `avatarUrl`   | string      | `""`             | The URL to the user's profile picture           |
| `isAnonymous` | boolean     | `false`          | Whether or not the user is anonymous            |
| `locale`      | string      | `"en"`           | A two-characters locale                         |
| `defaultRole` | string      | `"user"`         | The default role of the user                    |
| `roles`       | string[]    | `["me", "user"]` | The roles assigned to the user                  |
| `metadata`    | JSON object | `null`           | Additional attributes used for user information |
| `createdAt`   | string      |                  | The date-time when the user has been created    |

Example of an authenticated user:

```json
{
  "avatarUrl": "https://s.gravatar.com/avatar",
  "createdAt": "2022-04-11T16:33:14.780439+00:00",
  "defaultRole": "user",
  "displayName": "John Doe",
  "email": "john@nhost.io",
  "id": "05e054c7-a722-42e7-90a6-3f77a2f118c8",
  "isAnonymous": false,
  "locale": "en",
  "metadata": {
    "lastName": "Doe",
    "firstName": "John"
  },
  "roles": ["user", "me"]
}
```

### Avatar

```jsx
import { useAvatarUrl } from '@nhost/react';

const Avatar = () => {
  const avatar = useAvatarUrl();

  return <img src={avatar} alt="Avatar" />;
};
```

### User roles

```jsx
import { useUserRoles, useDefaultRole } from '@nhost/react';

const Avatar = () => {
  const roles = useUserRoles();
  const defaultRole = useDefaultRole();

  return (
    <div>
      Your default role is {defaultRole}. You have the following roles:{' '}
      {roles.join(', ')}
    </div>
  );
};
```

### Display name

```jsx
import { useDisplayName } from '@nhost/react';

const Avatar = () => {
  const displayName = useDisplayName();

  return <div>Hello, {displayName}</div>;
};
```

### Email

```js
const email = useEmail();
```

### User Id

```js
const userId = useUserId();
```

### Anonymous user

```js
const isAnonymous = useIsAnonymous();
```

### Locale

```js
const locale = useUserLocale();
```
