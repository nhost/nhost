# Nhost + React Native Starter

A React Native starter for iOS and Android with Nhost auth, built with Expo and
Expo Router. Users can sign in with a password, magic link, email code,
passkey, GitHub or Google, and manage their account.

It has the same screens and features as the Nhost + React and Nhost + Next.js
starters, and the same backend apart from the redirect settings, passkeys and
the code email. The end of How it works lists what works differently.

## What's included

- Five sign-in methods, each in its own folder under
  `frontend/src/screens/auth/`
- An account screen: profile, avatar, email, password, two-factor, passkeys,
  linked accounts, sessions, and account deletion
- The session kept in the device's keychain by the Nhost SDK, and every link
  back into the app carried as a one-time PKCE code
- `nhost/`: the backend config, Hasura permissions, and email templates

## Getting started

You need Xcode 26.4 or later for iOS (Expo SDK 58 doesn't build with older
versions), and Android Studio with an emulator for Android.

```sh
cp .secrets.example .secrets
nhost up
cd frontend
pnpm install
pnpm ios
```

`pnpm ios` builds the app, installs it on the iOS Simulator and starts the
bundler. The simulator shares your Mac's network, so it reaches `nhost up`
directly.

For Android, start an emulator first, then:

```sh
pnpm android:reverse
pnpm android
```

The local backend's addresses resolve to `127.0.0.1`, which on the emulator is
the emulator itself. `pnpm android:reverse` forwards port 443 back to your Mac.
That needs `adb root`, so use a system image labelled Google APIs: Google Play
images refuse it. Run it again after every emulator boot.

A physical device can't reach `nhost up` on your Mac. Run it against a cloud
project with this `nhost/` config instead: set `EXPO_PUBLIC_NHOST_SUBDOMAIN`
and `EXPO_PUBLIC_NHOST_REGION` in `frontend/.env.local` and run `pnpm ios` or
`pnpm android` again.

Emails the local stack sends, such as sign-in links and codes, land in Mailhog
at https://local.mailhog.local.nhost.run. Open a link on the device that asked
for it, in its browser, which hands it to the app.

Other commands in `frontend/`: `pnpm test`, `pnpm lint` and `pnpm build`.
`pnpm build` only checks that both bundles compile; apps ship through EAS, see
Deploying with EAS.

## Sign-in methods

Email and password, magic link and email code are on by default. Passkeys and
OAuth are off until you set them up.

To remove a method, delete its folder in `frontend/src/screens/auth/`, its
folder in `frontend/src/app/auth/` if it has one, and its entry in
`frontend/src/screens/signin/methods.ts`. For OAuth, the entry is `buttons` and
`buttonSettings` and their imports. Then remove the native modules only that
method uses and build the app again: `pnpm remove react-native-passkey
expo-device` for passkeys, `pnpm remove expo-web-browser` for OAuth.

### Turning on OAuth

1. Create an OAuth app with GitHub or Google. The callback URL is
   `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`
   (use `google` for Google).
2. Add the client ID and secret to `.secrets`.
3. Set `enabled = true` for the provider in `nhost/nhost.toml` and restart
   `nhost up`.
4. Add `EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS=github` (or `github,google`) to
   `frontend/.env.local` and restart `pnpm ios` or `pnpm android`.

Sign-in opens the provider in an in-app browser, which closes when auth sends
the user back to the app. Linking one from the account screen closes the
Linked accounts dialog before the browser opens, and the result shows on the
account screen.

### Turning on passkeys

A passkey belongs to a domain, and the OS only offers it to an app that domain
vouches for. So passkeys need a domain you control, served over HTTPS; there's
no local stand-in.

1. Serve two files from `https://<domain>/.well-known/`:
   - `apple-app-site-association`, with
     `{"webcredentials": {"apps": ["<team id>.io.nhost.starter"]}}`, where the
     team ID is your Apple developer team's.
   - `assetlinks.json`, with a `delegate_permission/common.get_login_creds`
     relation for the `android_app` `io.nhost.starter` and the SHA-256
     fingerprint of the key that signs the app. `./gradlew signingReport` in
     `frontend/android/` prints the debug key's; `eas credentials` shows the
     one EAS signs with.
2. In `.secrets`, set `WEBAUTHN_RP_ID` to the domain and
   `WEBAUTHN_ANDROID_ORIGIN` to `android:apk-key-hash:<hash>`, where the hash
   is that SHA-256 fingerprint as unpadded base64url:
   `echo <fingerprint> | tr -d : | xxd -r -p | base64 | tr +/ -_ | tr -d =`.
   Auth accepts sign-ins from `https://<domain>`, which is what iOS reports,
   and from that origin, which is what Android reports.
3. Set `enabled = true` under `[auth.method.webauthn]` in `nhost/nhost.toml`
   and restart `nhost up`.
4. Add `EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN=<domain>` to `frontend/.env.local`.
   `app.config.ts` adds it to the iOS app's associated domains, which are part
   of the native build, so delete `frontend/ios` and `frontend/android` and run
   `pnpm ios` and `pnpm android` again. Do the same whenever the domain
   changes.

Without `EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN`, the app has no passkey sign-in and
no Passkeys row on the account screen.

### Unlinking a provider

Unlink on the account screen deletes the link, but it doesn't stop that
provider signing in. If the provider reports a verified email that matches the
account's email, auth signs the user in to that account and links the provider
again. So unlinking a GitHub or Google account that someone else has taken over
doesn't lock them out. Changing the account's email does, and so does turning
the provider off in `nhost/nhost.toml`, which turns it off for every user.
Unlink removes a provider for good only when its verified email differs from
the account's, or the account has no email. That is why the screen keeps the
last link on an account with no email.

## Permissions

The `user` role can only touch its own rows, and only what the account screen
needs.

| Table | Allowed |
| --- | --- |
| `auth.users` | read, delete, update `display_name` and `avatar_url` |
| `auth.user_security_keys` | read, delete |
| `auth.refresh_tokens` | read, delete |
| `auth.user_providers` | read, delete |
| `storage.files` | upload to the `default` bucket, read, delete |

A few things to keep in mind if you change these:

- `auth.users` also holds the user's role and email, so don't let users update
  other columns.
- Never expose `refresh_token_hash` or the provider tokens in
  `auth.user_providers`.
- Keep the `storage.files` read columns as they are. Storage reads them back
  when it serves a file.

The app asks the device for one permission: reading the photo library, to pick
an avatar. Camera and microphone access are turned off in `app.config.ts`. On
Android 12 and older, `expo-image-picker` still adds the
`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` permissions to the
manifest.

## How it works

### Routes and screens

Expo Router turns every file under `frontend/src/app/` into a route, so that
folder holds only route files. Each one re-exports a screen from
`frontend/src/screens/`, which has the same folders and file names as the React
starter's `src/app/`. Helpers and tests live outside `src/app/`.
`frontend/src/screens/signin/isolation.test.ts` checks that no method imports
another and that shared code reaches a method only through `methods.ts`.

### Sessions

The SDK client in `frontend/src/lib/nhost/client.ts` keeps the session in
SecureStore: the iOS keychain, and on Android values encrypted with a key in
the Android Keystore. The keychain items are readable after the first unlock
after a restart, and never move to another device through a backup or iCloud
Keychain.

`frontend/src/lib/nhost/storage.ts` splits the session into chunks of at most
2048 bytes, because some iOS releases refused larger values, in two sets of
keys used in turn, and writes the header naming the current set last. A write
cut short leaves the previous session whole. The app never deletes a key,
because SecureStore's only delete is asynchronous and could land after a later
write; it writes an empty value instead.

SecureStore can't list its keys, so every key the app writes comes from the
fixed set in `frontend/src/lib/deviceStore.ts`. The iOS keychain outlives an
uninstall, so on the first launch after an install, before anything reads the
session, the app clears every key in that set and tries to revoke the session
it found. A marker file, which an uninstall does remove, says the launch isn't
the first. Android backups are off, since the Keystore key doesn't leave the
device and a restored backup would hold values nothing can decrypt.

The SDK refreshes the access token before a request when it's about to expire.
Refresh tokens can only be used once, so it refreshes under a lock.
`frontend/src/lib/polyfills.ts` installs an in-process lock before the SDK
loads; without one, the SDK uses none, and two refreshes at once spend the same
token and the loser signs the user out.

### Startup

Before the first screen renders, behind the splash screen,
`frontend/src/lib/nhost/startSession.ts` runs once per launch: it refreshes the
session if the access token expires within a minute, drops the session if its
row in `auth.refresh_tokens` is gone, and clears a password-reset hold left
without a session. Then the link the app was opened with, if any, is handled
(see Links back into the app). React Native's `fetch` has no timeout, so the
session steps get 10 seconds, and trading the link's code gets another 10, so
a cold start from a link can hold the splash screen for about 20 seconds. When
the session steps run out of time or the network fails, the app keeps the
stored session and renders, so a dead network can't hold the splash screen for
good. If auth later rejects that session, the app signs out and the next
navigation lands on sign-in.

### Links back into the app

Every flow whose email or redirect signs the user in sends a PKCE challenge:
magic links, sign-up verification, password reset, email change, and OAuth
sign-in. The app keeps the matching verifier, and auth sends the user back to
`nhost-starter://…` with a one-time code instead of a session. Only this app
on this device can trade that code for a session, so a link opened by another
app that claims the same scheme, or on another device, signs nobody in.

`frontend/src/lib/nhost/links.ts` handles every link before any screen sees
it. The OS hands links to `frontend/src/app/+native-intent.tsx`, and the
in-app browser hands back OAuth's. Each link is handled once, including when
Android delivers it twice or again after the app was killed:

- Signed out, the app trades the code for a session. A link this device didn't
  ask for, or a code auth refuses, shows the app's own error instead: open the
  link on the device that asked for it, or, for a verification link, sign in.
- Signed in, it throws the code away unused and reloads the screen, so a link
  from someone else can't replace the session, and a confirmed email change
  shows. An unused code expires after 5 minutes.
- A link this device has already handled is dropped without a message.
- `code`, `type`, `flow` and any `refreshToken` are removed before the route
  sees the link. The app never redeems a `refreshToken` from a link.

Asking for a new magic link makes the previous one stop working, since auth
keeps one per user.

Linking an OAuth provider sends no challenge. Auth returns to the app without a
code, so there is nothing to protect, but the session's access token goes to
auth in the in-app browser's URL. It's valid for 15 minutes.

### Guard

`frontend/src/guard.ts` is the counterpart of the Next.js starter's
`proxy.ts`. It keeps signed-out visitors off `/account`, sends signed-in
visitors on from the sign-in screens, and keeps a session from a
password-reset link on the reset screen until the new password is saved, also
after the app is killed and opened again. `SessionGuard` runs it before each
screen renders, so a protected screen never shows to a signed-out visitor. It
runs again when the session turns out to be revoked and when a screen loads
its data again.

The guard only decides where to send someone. The account screen asks auth who
the user is before it shows anything.

### Redirects

`?next=` is only followed if it's a path in this app, and it's checked again
wherever the app navigates to it or sends it to auth as a `redirectTo`. Expo
Router decodes query values twice; `signInDestination` checks the value after
that, which is the one the app uses.

### Session list

The account screen lists the user's sessions with when each one signed in. It
doesn't show device, IP address or location: the app has no trustworthy source
for them, so add that only once you have one.

Signing out a session deletes its row. Each device checks for its row at
launch, whenever the route's path changes, and when the app comes back to the
foreground after at least 5 minutes, so that device is signed out at its next
check rather than when its token expires. A revocation during a shorter
background is caught at the next navigation. The check on navigation runs
after the screen renders, so a revoked session can show one screen before it
lands on sign-in.

### Rate limits

Auth's limits in `nhost/nhost.toml` count requests per address. The app calls
auth directly, so each device is counted by its own address.

The brute-force limit allows 30 requests per address every 5 minutes, where the
Next.js starter allows 10. It counts every sign-in request, including the
two-factor step, plus link and code checks and the two-factor check before a
password change, so a passkey or two-factor sign-in uses two of them.

The local stack sends at most 10 emails an hour. The Android emulator reaches
it through your Mac, so the emulator and anything else on the Mac share that
budget. The counts live in the auth container's memory: restart `nhost up`, or
just the auth container (`docker ps` lists it as `<folder>-auth-1`, after the
project folder), to reset them.

### Avatars

Avatars are private files. `frontend/src/screens/account/useAvatarSrc.ts`
hands the image view the storage URL with the session's token in an
`Authorization` header, and those images are cached in memory only, never on
disk, and dropped at sign-out. `avatar_url` holds `/api/avatar/<id>`, the
format the Next.js starter writes, so the starters can share a backend if it
runs auth 0.53.0 or later. Gravatar URLs are shown as they are.

Only PNG, JPEG, WebP and AVIF are allowed, up to 4 MB. On iOS the picker
returns JPEG rather than HEIC. The picker also re-encodes photos at quality
0.7, so a full-resolution camera photo usually fits the limit; the app shows
avatars at 192 px at most. The web starters also refuse to show a
downloaded file of another type, because a browser could run scripts in it; a
native image view runs none, so the app doesn't check.

Uploads send the picked file as an `expo-file-system` `File`. Expo SDK 58
replaces the global `fetch` with one that refuses React Native's
`{ uri, name, type }` form-data parts.

### Password changes

Changing the password signs out every session. The app signs the user back in
on this device straight away. Until it has, it holds the SDK's session lock,
which pauses the app's other SDK requests, so nothing refreshes with a token
the change just revoked. If signing back in fails, the account screen says the
password changed and signs this device out.

With two-factor on, the form also asks for a code, which it needs to sign this
device back in. It checks the code first, through auth's `/elevate/totp` (auth
0.53.0 or later), so a wrong code changes nothing. Auth itself doesn't ask for
a code to change the password while `[auth.elevatedPrivileges]` is `disabled`,
so a stolen session could still change it. Turning that setting on makes auth
ask for a fresh check before changing the password or email, adding a passkey
or setting up two-factor, and this app has no step for that yet.

### Two-factor setup

Scanning a QR code needs a second device, so the setup shows auth's QR code
together with the secret, in groups of four with a copy button, and an Open in
authenticator button that opens the `otpauth://` link. When no app takes the
link, the button copies the secret instead.

### Email templates

`nhost/emails/` only has English templates. `clientUrl` is the app's
`nhost-starter://` scheme, which mail apps rarely turn into a link, so no
template links to it: the `signin-otp` email shows only the code, since the app
is already on the screen that asks for it. Auth pastes template variables in
without escaping them, so only use the ones auth builds or reads from config
(`link`, `ticket`, `code`, `clientUrl`, `serverUrl`), never `redirectTo`,
`email` or `displayName`, which come from the request.
`frontend/src/lib/nhost/emails.test.ts` checks both.

### Tests

Most tests mock the client. Some use the real SDK client with a stubbed
`fetch`, because a mock can't show what the SDK stores or sends. For example,
`session.integration.test.ts` and `startSession.integration.test.tsx` in
`frontend/src/lib/nhost/`, and
`frontend/src/screens/auth/password/change/actions.integration.test.ts`, which
sits in the password folder so it goes when the method does.

A few things that differ from writing for the web:

- React Native's global `URL` and `URLSearchParams` are simplified polyfills.
  Don't parse links with them; `links.ts` and `env.ts` read and build them by
  hand.
- Expo inlines each `process.env.EXPO_PUBLIC_*` where it's written out in full.
  Read them only in `frontend/src/lib/nhost/env.ts`, and in tests change the
  keys of `process.env` in place rather than replacing the object.
- `jest.setup.ts` fails any test that writes a SecureStore key outside the
  fixed set. Its `Modal` calls `onDismiss` once hidden, as iOS does.
- Pass a provider URL to the in-app browser through `inAppBrowserURL`. Given a
  raw `[`, iOS encodes the whole URL again, `redirectTo` included.
- Hermes on iOS returns the time in a date-and-time `formatToParts` as
  literal parts. Format the date and the time separately.
- Give a `Pressable` under an Expo Router `Link asChild` a plain `style`, not a
  function: the function was dropped on device.

### Compared with the React and Next.js starters

On a phone, with no browser and no server, some guarantees change:

- The session is in the keychain, not an httpOnly cookie or `localStorage`.
  There are no page scripts to read it, so there's no Content Security Policy,
  but any code you add to the app can read it.
- Links back to the app carry a PKCE code, not a `refreshToken`, and only work
  on the device that asked for them. A link opened while signed in has its code
  discarded rather than revoked, and the code expires in 5 minutes.
- Links come back to the fixed `nhost-starter://` scheme, so there's no
  `APP_ORIGIN` secret. Any app can register the same scheme; PKCE is what makes
  that harmless.
- The SDK refreshes on the device under an in-process lock, as in the React
  starter but without tabs: nothing follows other tabs, and a password change
  pauses only this app.
- The session is checked again when the route's path changes and when the app
  returns to the foreground after 5 minutes, instead of on every page load or
  tab focus. A revoked session can show one screen before it lands on
  sign-in.
- Startup gives the network 10 seconds, plus 10 more to trade the code of the
  link the app opened with, then renders with the stored session.
- Reinstalling the app signs out the previous install's session, and Android
  backups are off.
- Avatars load with an `Authorization` header and stay out of the disk cache.
  There's no download type check, and uploads go straight to storage, so 4 MB
  is the app's own limit.
- Passkeys are off by default and need a real domain, since `localhost`
  doesn't count as one for an app.
- The code email has no link, and the code screen takes no `?email=`.
- Two-factor setup shows the secret and an `otpauth://` button besides the QR
  code.
- `EXPO_PUBLIC_*` values are built into the app bundle, so the list of OAuth
  providers and the passkey domain are public.
- As in the React starter, the backend runs auth 0.53.0 with a brute-force
  limit of 30 requests every 5 minutes, auth sees each device's own address,
  a two-factor password change checks the code first, and when auth can't say
  who the user is for a reason other than rejecting the token, the account
  screen shows an error instead of going to sign-in.

## Deploying with EAS

`frontend/eas.json` has `preview` and `production` build profiles. Before you
build:

- Point the app at your project: set `EXPO_PUBLIC_NHOST_SUBDOMAIN`,
  `EXPO_PUBLIC_NHOST_REGION` and, with them on,
  `EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS` and `EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN` as
  EAS environment variables or in the profile's `env` in `eas.json`. Expo
  builds them into the bundle, so setting them at runtime does nothing, and
  `frontend/.env.local` stays on your machine.
- Give the app its own name, scheme and identifiers:
  - `name`, `slug` and `scheme` in `frontend/app.config.ts`
  - `APP_SCHEME` in `frontend/src/lib/nhost/env.ts`
  - `clientUrl` and `allowedUrls` in `nhost/nhost.toml`
  - `ios.bundleIdentifier` and `android.package` in `frontend/app.config.ts`,
    and in the passkey files above

  `env.test.ts` fails if the scheme settings disagree.
- Set the OAuth and `WEBAUTHN_*` secrets with `nhost secrets create`.
  `nhost.toml` refers to all of them, so they must exist even with OAuth and
  passkeys off, and the values in `.secrets.example` are fine. With passkeys
  on, set `WEBAUTHN_RP_ID` to the real domain and `WEBAUTHN_ANDROID_ORIGIN` to
  the `apk-key-hash` origin of the key EAS signs with.
- For OAuth, use the callback URL
  `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/github/callback`
  and set the client ID and secret with `nhost secrets`.

## Troubleshooting

- The Android emulator can't reach the backend: run `pnpm android:reverse`
  again. It has to run after every boot, and fails on Google Play images.
- Gradle refuses your JDK: set `JAVA_HOME` to the one Android Studio ships,
  `/Applications/Android Studio.app/Contents/jbr/Contents/Home` on macOS.
- A change to `app.config.ts`, the passkey domain or a native module doesn't
  show: delete `frontend/ios` and `frontend/android` and build again. A
  change to `frontend/.env.local` needs the bundler restarted.
- Emails stop arriving: the local limit of 10 an hour is used up. See Rate
  limits.
- Typing into a debug build with `adb shell input text` reloads the app: focus
  a field first. Keys sent with nothing focused reach the developer menu, where
  `rr` reloads the bundle.
