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
