---
name: create-function
description: Add and verify a file-routed serverless HTTP function under backend/functions.
---

# Create a serverless function

Use this skill for webhooks, custom HTTP endpoints, or server-side logic that does not belong in the frontend. Functions use file-based routing: `backend/functions/hello.js` maps to `/v1/hello`, while `backend/functions/users/index.js` maps to `/v1/users`.

## 1. Create the function file

Run this from the project root:

```sh
mkdir -p backend/functions
cat > backend/functions/hello.js <<'EOF'
export default function handler(req, res) {
  const name = typeof req.query.name === 'string' ? req.query.name : 'world';

  res.status(200).json({
    message: `hello ${name}`,
    method: req.method,
  });
}
EOF
```

Rename the file and adapt the handler to the requested endpoint. Prefix shared helper directories with `_`, such as `backend/functions/_utils/`, so they are not exposed as routes. Validate request bodies and headers before using them, return explicit HTTP status codes, and never log tokens or secrets.

## 2. Start the local runtime

Start the backend from its directory:

```sh
(cd backend && nhost up)
```

The runtime watches `backend/functions/` and hot-reloads file edits. No schema or frontend code generation is needed for a function-only change.

## 3. Call the endpoint and inspect logs

In another terminal, call the local route:

```sh
curl 'https://local.functions.local.nhost.run/v1/hello?name=Nhost'
```

Inspect function output and runtime errors through the CLI:

```sh
(cd backend && nhost logs functions)
```

If the function needs environment variables, declare each one under `[[global.environment]]` in `backend/nhost/nhost.toml`. The functions container receives the system variables plus the names declared there, so a bare key in `backend/.secrets` never reaches `process.env`. Keep sensitive values in `backend/.secrets`, which is gitignored, and reference them from the config entry; do not commit real secrets:

```toml
[[global.environment]]
name = 'MY_KEY'
value = '{{ secrets.MY_KEY }}'
```

Restart `nhost up` after editing either file. For third-party packages, `backend/functions/package.json` and `backend/functions/package-lock.json` already exist: run `npm install <package>` from `backend/functions/`, then commit the updated `package-lock.json`. The running runtime reinstalls when the lockfile changes. Do not add a lockfile of another flavour beside it — the runtime installs from the first of `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, so a `pnpm-lock.yaml` is ignored and the packages it declares are silently never installed.
