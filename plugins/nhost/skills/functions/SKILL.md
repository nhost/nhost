---
name: functions
description: Writes, runs, secures, and deploys Nhost Functions, the Node.js/TypeScript serverless HTTP endpoints in a project's `functions/` folder. Use when the user wants a custom backend endpoint, webhook, API route, server-side logic, a Stripe/Slack/third-party integration, or a handler for Nhost event or cron triggers; when calling a function from the app with `nhost.functions.fetch` or `nhost.functions.post`; verifying a user's JWT or access token inside a function; using the admin secret or `withAdminSession` server-side; setting secrets or environment variables for functions; fixing CORS, timeouts, or native-dependency errors; choosing the Node.js version; or testing at `local.functions.local.nhost.run`. Not for Nhost Run containers, sign-in flows, or database permissions.
---

# Nhost Functions

Each `.js` or `.ts` file in the project's `./functions` folder becomes an HTTP endpoint. Use this skill for writing, calling, securing, and deploying them. For auth flows use the `auth` skill; for table permissions use the `database` skill; for custom containers, native binaries, or non-JS runtimes point the user to [Nhost Run](https://docs.nhost.io/products/run).

## Look things up first

- With the Nhost MCP server: use its docs `search` tool (the name may have a host prefix).
- Without MCP: `nhost docs search "functions cors"`, `nhost docs show <path>`, or https://docs.nhost.io/llms.txt.
- Start at [Functions overview](https://docs.nhost.io/products/functions). Do not rely on memory for SDK calls or config keys.

## Handler and routing

```ts
// ./functions/hello.ts
import type { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  res.status(200).send(`Hello ${req.query.name}!`)
}
```

- `functions/index.js` -> `/v1/`, `functions/users/index.ts` -> `/v1/users`, `functions/users/active.ts` -> `/v1/users/active`.
- All HTTP methods hit the same handler. Branch on `req.method`.
- Files and folders starting with `_` (for example `functions/_utils/`) are not exposed. Put shared helpers there.
- Besides standard Express fields, `req.rawBody` (Buffer) and `req.invocationId` exist. Log `req.invocationId` to trace a request.
- Production URL: `https://<subdomain>.functions.<region>.nhost.run/v1/<path>`. Local URL: `https://local.functions.local.nhost.run/v1/<path>`.
- For TypeScript types: `npm install -D @types/express`. If there is no `tsconfig.json` in the functions folder, one is created for you.

## Dependencies and runtime

- Commit a lockfile (`package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`) in the functions folder or a parent folder. Without one, the runtime can't install dependencies and won't start. If there are several lockfiles, npm wins over pnpm, and pnpm wins over yarn.
- Node.js version is set in `nhost/nhost.toml`. The options are 22, 24 (the default), and 26:
  ```toml
  [functions.node]
  version = 24
  ```
- Each function is bundled into a single JS file, so native addons don't work (`sharp`, `bcrypt`, `better-sqlite3`, `canvas`). Suggest a pure-JS alternative (`bcryptjs` for `bcrypt`) or Nhost Run.

## Environment variables and secrets

- These are injected automatically: `NHOST_ADMIN_SECRET`, `NHOST_WEBHOOK_SECRET`, `NHOST_JWT_SECRET` (a JSON string), `NHOST_SUBDOMAIN`, `NHOST_REGION`, `NHOST_HASURA_URL`, `NHOST_AUTH_URL`, `NHOST_GRAPHQL_URL`, `NHOST_STORAGE_URL`, `NHOST_FUNCTIONS_URL`. Locally, `NHOST_REGION` is `local`.
- To add your own value (for example an API key), store the value as a secret and reference it from `nhost/nhost.toml`:
  ```toml
  [[global.environment]]
  name = 'STRIPE_SECRET_KEY'
  value = '{{ secrets.STRIPE_SECRET_KEY }}'
  ```
  - Locally: add the value to the `.secrets` file at the project root (not `.env`). Make sure `.secrets` is listed in `.gitignore`, and check again after any `nhost init`.
  - Cloud: the user sets it in Dashboard -> Settings -> Secrets, or runs `nhost secrets create NAME VALUE`. Ask the user to run this themselves. Never put a real secret value in a file, a command you show, or a commit.
- Read values with `process.env.NAME`. Never hardcode them.

## Calling a function from the app (`@nhost/nhost-js` v4)

```ts
const res = await nhost.functions.post('/helloworld', { message: 'Hello' }) // JSON POST
const res2 = await nhost.functions.fetch('/helloworld', { method: 'GET' })
console.log(res.body) // response is { body, status, headers }
```

- A client made with `createClient` automatically attaches the signed-in user's access token as `Authorization: Bearer ...`.
- A status of 300 or above throws `FetchError` (from `@nhost/nhost-js/fetch`). Use try/catch, not `{ data, error }`.
- Do not use v3 APIs (`new NhostClient`, `@nhost/react`, `@nhost/nextjs`). See [functions SDK reference](https://docs.nhost.io/reference/javascript/nhost-js/functions).

## Security rules (always apply)

- For any user-specific function, verify the `Authorization` bearer token inside the function before doing anything, and return 401 if it fails. Get the user ID from the verified token's `sub` claim. Never trust a user ID, role, or email sent in the body or query. See [references/auth-and-sdk.md](references/auth-and-sdk.md).
- To act with the caller's permissions, forward their `Authorization` header to nhost-js. Use `withAdminSession({ adminSecret: process.env.NHOST_ADMIN_SECRET })` only when you need to bypass permissions, and only after you've checked that the caller is allowed.
- `NHOST_ADMIN_SECRET` only ever lives in server-side code (functions, backends). Never send it to the browser, return it in a response, log it, or put it in frontend env vars.
- For event or cron trigger webhooks: configure the trigger to send the `nhost-webhook-secret` header (`value_from_env: NHOST_WEBHOOK_SECRET`), then reject requests whose header doesn't match `process.env.NHOST_WEBHOOK_SECRET`. See [Webhook security](https://docs.nhost.io/products/events/guides/webhook-security).

## CORS

The defaults are `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: origin,Accept,Authorization,Content-Type`. They only cover simple GET/POST requests. The runtime passes `OPTIONS` preflight requests to your handler, and it doesn't set `Allow-Methods` or `Allow-Credentials`. In production, restrict the origin, for example with the `cors` npm package. Details: [CORS guide](https://docs.nhost.io/products/functions/guides/cors).

## Errors, logs, limits

- Wrap the handler body in try/catch. Log errors with `console.error(...)`, then return a status code and `{ error }`. An uncaught throw gives the caller a generic 500.
- Logs: `nhost logs functions` locally, or the Logs page in the dashboard.
- Timeout depends on the plan: Starter 10 s, Pro 180 s, Teams 600 s, Enterprise custom. Request and response bodies are capped at 6 MB. If a job needs more, suggest Nhost Run or splitting the work. Don't try to work around the limits.

## Run and deploy

1. `nhost up`, then `curl https://local.functions.local.nhost.run/v1/<path>`. Changes reload automatically.
2. Deploy by committing and pushing to the GitHub branch connected to the project. Nhost deploys new or changed functions along with config, migrations, and metadata. `nhost deployments new --ref <commit-sha> --message "..." --user <name> --follow` (experimental) starts a deployment manually for a commit that's already pushed. Ask before pushing or deploying.

More detail: [Getting started](https://docs.nhost.io/products/functions/guides/getting-started), [Local development](https://docs.nhost.io/products/functions/local-development), [Limits](https://docs.nhost.io/products/functions/limits), [Deployments](https://docs.nhost.io/platform/cloud/deployments).

The user's instructions take precedence over this skill.
