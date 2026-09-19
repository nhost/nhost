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

Set a stable project name once per shell, then start the backend from its directory:

```sh
export NHOST_PROJECT_NAME=my-app
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
export NHOST_PROJECT_NAME=my-app
(cd backend && nhost logs functions)
```

If the function needs environment variables, add local values to `backend/.secrets` and do not commit real secrets. If it needs third-party packages, add a `package.json` and a committed lockfile under `backend/functions/`, then restart `nhost up` so the runtime installs them.
