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

| Variable             | Default                                        | Notes                                             |
| -------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `NHOST_SUBDOMAIN`    | `local`                                        | Used when the `*_URL` overrides are unset.        |
| `NHOST_REGION`       | `local`                                        |                                                   |
| `NHOST_AUTH_URL`     | *(unset)*                                      | Override, e.g. `http://auth:4000/v1` in-cluster.  |
| `NHOST_STORAGE_URL`  | *(unset)*                                      | Override, e.g. `http://storage:5000/v1`.          |
| `PUBLIC_STORAGE_URL` | `https://local.storage.local.nhost.run/v1`     | Only used to build download links in responses.   |
| `NHOST_EMAIL`        | `cat-uploader@example.com`                     | Service user (created on first run).              |
| `NHOST_PASSWORD`     | `password-1234`                                |                                                   |
| `CATAAS_URL`         | `https://cataas.com`                           |                                                   |
| `PORT`               | `8080`                                         |                                                   |

## Run locally (against the CLI backend)

Start the local backend (from `packages/nhost-go`):

```sh
./dev-env.sh up
```

Then run the service directly — with no `*_URL` overrides it uses the public
`local` URLs:

```sh
cd examples/cat-uploader
go run .

# in another terminal:
curl -s -X POST 'http://localhost:8080/upload?count=3' | jq
```

## Run as an Nhost Run service

The CLI doesn't build images, so build it first. The build context must be the
SDK package root (`packages/nhost-go`) so the `replace` in `go.mod` resolves the
local SDK:

```sh
cd packages/nhost-go
docker build -f examples/cat-uploader/Dockerfile -t cat-uploader:dev .
```

Then start it alongside the stack (from `packages/nhost-go/build/backend`); the
service config points `NHOST_AUTH_URL`/`NHOST_STORAGE_URL` at the internal
service names:

```sh
cd build/backend
nhost up --run-service ../../examples/cat-uploader/nhost-run-service.toml

# the published port is reachable from your laptop:
curl -s -X POST 'http://localhost:8080/upload?count=3' | jq
```

Each entry in the response includes a `url` pointing at the uploaded file, e.g.
`https://local.storage.local.nhost.run/v1/files/<id>` (downloading it requires a
valid session or the admin secret, per your Storage permissions).
