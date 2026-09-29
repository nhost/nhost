# cat-uploader — Nhost Go SDK Run service example

A small HTTP service that demonstrates the Nhost Go SDK end to end, designed to
run as an [Nhost Run](https://docs.nhost.io/products/run/overview) service:

```
POST /upload?count=N
```

1. fetches `N` random cat pictures from [cataas.com](https://cataas.com) (Cat-as-a-Service),
2. uploads the images to **Nhost Storage**,
3. returns the resulting file IDs, names and public URLs as JSON.

A Run service is trusted server-side code, so it authenticates with the **admin
secret** rather than signing in as a user — the same pattern the
[serverless-function examples](../backend/functions) use. `nhost.WithAdminSession`
attaches the secret to every storage request, so there is no session to
establish at startup and no user credentials to provision.

> [!WARNING]
> The admin secret grants unrestricted access and must never reach a browser or
> any client outside your backend network. This example also sets
> `AllowInsecureHTTP`, which is required only because a Run service reaches
> storage over plain HTTP at `http://storage:5000/v1` inside the Nhost network.
> Never enable it for a client that leaves that network.

## Endpoints

| Method | Path                  | Description                                   |
| ------ | --------------------- | --------------------------------------------- |
| POST   | `/upload?count=N`     | Upload `N` cats (default 1, max 10).          |
| GET    | `/healthz`            | Liveness probe.                               |

## Configuration (environment variables)

| Variable             | Default                                    | Notes                                             |
| -------------------- | ------------------------------------------ | ------------------------------------------------- |
| `NHOST_SUBDOMAIN`    | `local`                                    | Used when the `*_URL` overrides are unset.        |
| `NHOST_REGION`       | `local`                                    |                                                   |
| `NHOST_AUTH_URL`     | *(unset)*                                  | Override, e.g. `http://auth:4000/v1` in-cluster.  |
| `NHOST_STORAGE_URL`  | *(unset)*                                  | Override, e.g. `http://storage:5000/v1`.          |
| `PUBLIC_STORAGE_URL` | `https://local.storage.local.nhost.run/v1` | Only used to build download links in responses.   |
| `NHOST_ADMIN_SECRET` | **required**                               | Store this as a secret; never commit its value.   |
| `CATAAS_URL`         | `https://cataas.com`                       |                                                   |
| `PORT`               | `8080`                                     |                                                   |

Startup fails if `NHOST_ADMIN_SECRET` is missing.

## Run locally

Start the backend this example runs against:

```sh
cd ../backend-cats && ./env-up.sh   # or, from here: make backend-up
```

Only one local backend can run at a time, so stop any other one first.

Then run the service directly — with no `*_URL` overrides it uses the public
`local` URLs. The local backend's admin secret is the one in
[`../backend-cats/.secrets.example`](../backend-cats/.secrets.example):

```sh
cd examples/demos/cat-uploader
export NHOST_ADMIN_SECRET='nhost-admin-secret'
go run .

# in another terminal:
curl -s -X POST 'http://localhost:8080/upload?count=3' | jq
```

## Run as an Nhost Run service

The CLI doesn't build images, so build it first. This example belongs to the
repository's single root Go module and builds against its committed `vendor/`
tree. The build context must therefore be the repository root so Docker can
include the root `go.mod`, `go.sum`, and `vendor/`:

```sh
# from the repository root
docker build -f examples/demos/cat-uploader/Dockerfile -t cat-uploader:dev .
```

The Run config reads the admin secret from the backend's Nhost secrets. That
secret already exists as `HASURA_GRAPHQL_ADMIN_SECRET`, so the only setup step
is creating `.secrets` from the committed template if you have not already:

```sh
cd examples/demos/backend-cats
[ -f .secrets ] || cp .secrets.example .secrets
```

Then start the image alongside the stack (from
`examples/demos/backend-cats`); the service config points
`NHOST_AUTH_URL`/`NHOST_STORAGE_URL` at the internal service names:

```sh
cd examples/demos/backend-cats
nhost up --run-service ../cat-uploader/nhost-run-service.toml

# the published port is reachable from your laptop:
curl -s -X POST 'http://localhost:8080/upload?count=3' | jq
```

For a Cloud deployment the project's admin secret is already available to Run
services as `HASURA_GRAPHQL_ADMIN_SECRET`, so this Run config needs no
additional secrets.

At most two upload requests run concurrently; excess requests receive `503
Service Unavailable`. Each downloaded image is limited to 2 MiB so the service
stays within the configured 128 MiB memory budget. Each response entry includes
a `url` pointing at the uploaded file, e.g.
`https://local.storage.local.nhost.run/v1/files/<id>` (downloading it requires a
valid session or the admin secret, per your Storage permissions).
