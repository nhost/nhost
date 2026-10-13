# Nhost + Next.js starter

Two halves, laid out the way an Nhost project is:

- `nhost/` is the backend configuration `nhost up` runs. It is what
  `nhost init` writes, with the sign-in methods this app offers switched on.
- `frontend/` is the Next.js app. See its README for the commands.

## Running it

```sh
cp .secrets.example .secrets
nhost up
cd frontend && pnpm install && pnpm dev
```

`.secrets` holds the local development secrets, including the JWT keypair the
auth service signs sessions with. The example file is the fixed set `nhost init`
writes for every local project, so copying it is all a local stack needs. It is
gitignored, and it must stay that way once it holds anything real.

`nhost up` prints the local URLs. The frontend targets the local stack by
default, so nothing in `frontend/.env.example` needs setting until the app
points at a real project.

## Sign-in methods

`frontend/src/app/signin/methods.ts` lists them. Three work as soon as the
backend is up: email and password is always on, and `nhost/nhost.toml` turns
on magic link and the email code. The fourth needs you.

### OAuth

A provider only works once an app is registered with it and the backend knows
the app's credentials. The config is already wired to `.secrets`, so it is
three steps:

1. Register an OAuth app with GitHub or Google. The callback URL for the local
   stack is `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`,
   with `google` in place of `github` for Google.
2. Put the client id and secret in `.secrets`, replacing the `fixme` values.
3. Set `enabled = true` on that provider in `nhost/nhost.toml`, then restart
   `nhost up`.

Until then the button is there but the auth service refuses the redirect, and
the home page shows its reason.
