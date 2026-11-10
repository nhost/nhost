# Sharing TypeScript code between functions and a Run service

This example shares TypeScript types and a runtime helper without publishing an
npm package or using npm/pnpm workspaces. Relevant files:

```text
myproject/
├── functions/
│   └── shared-greeting.ts
├── shared/
│   ├── types.ts
│   ├── greeting.ts
│   └── package.json
├── services/
│   └── my-service/
│       ├── src/
│       ├── package.json
│       ├── Dockerfile
│       ├── Dockerfile.dockerignore
│       └── nhost-run-service.toml
└── nhost/
    └── nhost.toml
```

- `shared/types.ts` defines the `Greeting` response type.
- `shared/greeting.ts` creates the response. Both consumers import this helper
  too, so the example exercises runtime imports, not just erased type imports.
- `functions/shared-greeting.ts` exposes `/shared-greeting` as a serverless function.
- `services/my-service/src/server.ts` exposes the same endpoint in a Run service.
- `shared/package.json` declares ES modules; the shared directory is not installed
  or published as a dependency.

The function uses relative imports:

```ts
import { createGreeting } from '../shared/greeting.ts';
import type { Greeting } from '../shared/types.ts';
```

The Run service uses the same files, with paths relative to its `src/` directory:

```ts
import { createGreeting } from '../../../shared/greeting.ts';
import type { Greeting } from '../../../shared/types.ts';
```

Nhost bundles the function with esbuild. The Run service uses Node.js 24's built-in
TypeScript stripping and has no npm dependencies. Neither path type-checks the
code. The `.ts` import extensions also work with the example's `noEmit` /
`allowImportingTsExtensions` TypeScript configuration.

## Run locally

Run these commands from this directory. You need Docker and the Nhost CLI.

Build the Run service image **with this project directory as the build context**:

```sh
docker build \
  --file services/my-service/Dockerfile \
  --tag myproject-shared-types:dev \
  .
```

The project-root context makes `shared/` available to `COPY`. Building with
`services/my-service/` as the context will not work. The Dockerfile-specific
ignore file allows only the service source and shared code into the context,
excluding project secrets and unrelated files.

Start the existing Nhost project with the additional Run service:

```sh
nhost up --run-service services/my-service/nhost-run-service.toml
```

The CLI does not build the image for you. It mounts this project root into the
functions container, so both `functions/` and `shared/` are available locally.

Using the default local subdomain:

```sh
curl https://local.functions.local.nhost.run/v1/shared-greeting
# {"message":"Hello from shared code!","source":"function"}

curl http://localhost:8000/shared-greeting
# {"message":"Hello from shared code!","source":"run-service"}
```

Rebuild the Run image and restart its container after changing its source or
shared code. The functions runtime watches its imported runtime source files.
For cloud Run deployment, publish the image to a registry and update `[image].image`
in the service configuration; the `:dev` image here is local only.

## Test without the Nhost stack

With Node.js 24 or newer, run the dependency-free smoke tests:

```sh
node --test test/shared-types.test.mjs
```

These invoke the function handler and make HTTP requests to the Run service on
an ephemeral port. They do not exercise Nhost's esbuild bundling or cloud deployment.

To run just the Run service without Docker:

```sh
node services/my-service/src/index.ts
```

Then request `http://localhost:8000/shared-greeting`.
