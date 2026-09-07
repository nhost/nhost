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
export NHOST_EMAIL='cat-uploader@example.com'
read -rsp 'Service user password: ' NHOST_PASSWORD && export NHOST_PASSWORD
printf '\n'
go run .
```

Stop the backend with `nhost down --volumes`.

## Why email verification is off

`nhost.toml` sets `emailVerificationRequired = false`.

`cat-uploader` is a headless service: on first run it signs its service user up
and starts serving only if that sign-up returns a session. With verification
required, sign-up returns no session, and the service exits telling you to
verify the user first — there is no browser in the loop to click a link. Turning
verification off is what makes the example start unattended, which is the point
of a Run service.

That is a choice appropriate to a machine-to-machine service, not general
advice. The sibling `backend/` keeps verification on, as an app with real users
should.

## Storage permissions

Uploads are restricted to the `default` bucket and stamped with
`uploaded_by_user_id`; reads are filtered to the uploader. The URLs
`cat-uploader` returns therefore need that service user's token to fetch — they
are not anonymously readable, despite being shaped like public links. If you
want the pictures to load in a browser without a token, add a `public` role
select permission on `storage.files`.
