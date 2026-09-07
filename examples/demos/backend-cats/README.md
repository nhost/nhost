# backend-cats

The Nhost project the [`cat-uploader`](../cat-uploader) example runs against.

It is deliberately tiny: no application tables, no serverless functions. The
example only needs **Auth** (to sign a service user in) and **Storage** (to put
cat pictures in the built-in `default` bucket), so that is all this backend
configures.

The sibling [`backend/`](../backend) serves the React, Express and Outline
demos and carries a much larger schema. Only one local backend can run at a
time — the CLI binds fixed `local.*.local.nhost.run` hostnames — so start
whichever one matches the demo you are running.

## Run it

```sh
cd examples/demos/backend-cats
./env-up.sh          # copies .secrets.example to .secrets on first run, then `nhost up`
```

Then start the service, from [`../cat-uploader`](../cat-uploader):

```sh
export NHOST_ADMIN_SECRET='nhost-admin-secret'   # matches .secrets.example
go run .
```

Stop the backend with `nhost down --volumes`.

## How cat-uploader authenticates

`cat-uploader` is a Run service — trusted server-side code — so it authenticates
with the **admin secret** rather than signing in as a user, the same way the
serverless-function examples do. It creates no user, holds no session, and needs
nothing provisioned before it starts.

## Storage permissions

Uploads go to the built-in `default` bucket. Because the admin secret bypasses
permissions, uploaded files have no owning user, so `storage.files` grants
`select` to the **public** role, filtered to that bucket. That is what makes the
URLs `cat-uploader` returns load in a browser, which is the entire output of the
demo.

That is a demo choice, not general advice: it makes every file in the `default`
bucket world-readable. An app with real users should scope reads to the uploader
(`uploaded_by_user_id = X-Hasura-User-Id`) instead, as the sibling `backend/`
does.
