# backend-sdk-tests

The local Nhost project that every SDK's integration suite runs against. It is a
test fixture, not a published package and not an example — nothing here is meant
to be read as a model for building an app.

Each SDK starts and stops it through its own `dev-env.sh`, which is what
`make dev-env-up` / `make dev-env-down` call from the package directory:

```sh
cd packages/nhost-rust   # or nhost-js, nhost-go, nhost-python
make dev-env-up
```

That copies `.secrets.example` to `.secrets` on first run and then invokes
`nhost up` here. Only one local backend can run at a time, since the CLI binds
fixed `local.*.local.nhost.run` hostnames.

## Why it is shared

Every SDK exercises the same surface — auth, GraphQL, storage, functions — so
they need the same schema and the same server behaviour. It previously existed
as four byte-identical copies, one per SDK package, which drifted apart the
moment one of them needed a change.

## Why it is not one of the `examples/` backends

The settings here are deliberately test-only and would be bad advice in an
example:

- `emailVerificationRequired = false`, so tests can sign a user up and use the
  session immediately
- rate limits raised ~1000×, so a test run is not throttled
- service versions pinned to what the SDKs are tested against, independently of
  what the tutorials demonstrate

The `examples/*/backend` projects are the opposite: they model what a real
project should look like. Keep the two sets of concerns apart.

## Contents

- `movies` — a table seeded with rows readable by the `public` role, used by
  GraphQL query tests
- `functions/` — `helloworld`, `echo` and `crash`, covering the success, echo
  and failure paths of the functions client
- storage buckets and auth configuration used by the storage and auth tests

When you change the schema here, every SDK's integration tests are affected, so
run them across the SDKs you touched.
