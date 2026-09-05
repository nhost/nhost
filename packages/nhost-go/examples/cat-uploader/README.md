# cat-uploader — Nhost Go SDK Run service example

A small HTTP service that demonstrates the Nhost Go SDK end to end, designed to
run as an [Nhost Run](https://docs.nhost.io/products/run/overview) service:

```
POST /upload?count=N
```

1. fetches `N` random cat pictures from [cataas.com](https://cataas.com) (Cat-as-a-Service),
2. authenticates against **Nhost Auth** (email/password),
3. uploads the images to **Nhost Storage** using the authenticated session,
4. returns the resulting file IDs, names and public URLs as JSON.

It authenticates once at startup, signing the service user up on first run, and
relies on the SDK's client-side session middleware to attach the bearer token
and refresh it automatically.

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
| `NHOST_EMAIL`        | **required**                               | Service user (created on first run).              |
| `NHOST_PASSWORD`     | **required**                               | Store this as a secret; never commit its value.   |
| `CATAAS_URL`         | `https://cataas.com`                       |                                                   |
| `PORT`               | `8080`                                     |                                                   |

Startup fails if either credential is missing. If sign-up succeeds without a
session because email verification is enabled, the service also exits with an
instruction to verify the service user's email and restart it; it never starts
an upload endpoint without an authenticated session.

## Run locally (against the CLI backend)

Start the local backend (from `packages/nhost-go`):

```sh
./dev-env.sh up
```

Then run the service directly — with no `*_URL` overrides it uses the public
`local` URLs. Supply a service-user email and a unique password in your shell:

```sh
cd examples/cat-uploader
export NHOST_EMAIL='cat-uploader@example.com'
read -rsp 'Service user password: ' NHOST_PASSWORD && export NHOST_PASSWORD
printf '\n'
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
docker build -f packages/nhost-go/examples/cat-uploader/Dockerfile -t cat-uploader:dev .
```

The Run config reads both service-user credentials from Nhost secrets. For
local development, append unique values to the ignored
`packages/nhost-go/build/backend/.secrets` file — the backend also needs the
secrets in `.secrets.example`, so create it from that template first and
**append** rather than overwrite, or `nhost up` fails with
`variable not found: secrets.HASURA_GRAPHQL_ADMIN_SECRET`:

```sh
cd packages/nhost-go/build/backend
[ -f .secrets ] || cp .secrets.example .secrets
cat >> .secrets <<EOF
NHOST_EMAIL = 'cat-uploader-run@example.com'
NHOST_PASSWORD = '$(openssl rand -hex 24)'
EOF
```

This uses a different service user from the local run above, because the first
run creates the account: reusing that email with a fresh password would fail
with `sign-in and sign-up both failed`.

Then start the image alongside the stack (from
`packages/nhost-go/build/backend`); the service config points
`NHOST_AUTH_URL`/`NHOST_STORAGE_URL` at the internal service names:

```sh
cd packages/nhost-go/build/backend
nhost up --run-service ../../examples/cat-uploader/nhost-run-service.toml

# the published port is reachable from your laptop:
curl -s -X POST 'http://localhost:8080/upload?count=3' | jq
```

For a Cloud deployment, set `NHOST_EMAIL` and `NHOST_PASSWORD` in the project's
**Settings → Secrets** before deploying this Run config. Use an address you can
verify, or disable email verification before the service user is first created.

At most two upload requests run concurrently; excess requests receive `503
Service Unavailable`. Each downloaded image is limited to 2 MiB so the service
stays within the configured 128 MiB memory budget. Each response entry includes
a `url` pointing at the uploaded file, e.g.
`https://local.storage.local.nhost.run/v1/files/<id>` (downloading it requires a
valid session or the admin secret, per your Storage permissions).
