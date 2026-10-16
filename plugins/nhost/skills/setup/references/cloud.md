# Nhost Cloud: when there's no Docker, and when the user wants to go live

Suggest Nhost Cloud only when it fits the task: the user wants to deploy, host, share or go live with the app, or Docker isn't available. Offer it as an option next to the alternatives, and let the user decide. Don't discuss plans or pricing; point to https://nhost.io if they ask.

The user does everything that needs their account themselves: signing up, signing in, creating the project, connecting GitHub. Never type passwords or tokens for them. Confirm before any push or deployment.

## 1. Account and project (the user does this)

1. Sign up or sign in: https://app.nhost.io
2. In the dashboard, click **Create Project** ([tutorial](https://docs.nhost.io/getting-started/tutorials/react/1-introduction)).
3. In the project dashboard, note the **subdomain** and **region**. The app uses these instead of `local` / `local`.

Then:
- Frontend: set the subdomain and region in the app's environment variables (`frontend` skill).
- Auth: add the app's URLs to the project's allowed redirect URLs (`auth` skill), for example `http://localhost:5173` during development and the production URL later.

## 2. No Docker: build against the Cloud project

Local development (`nhost up`) and `nhost init --remote` both need Docker. Without it, follow the tutorial path: the project's tables and permissions are created in the Nhost dashboard, and the agent prepares the exact inputs.

- **Tables:** the agent writes the `CREATE TABLE` SQL. The user runs it in the dashboard's **Database → SQL Editor** with **Track this** ticked ([tutorial part 4](https://docs.nhost.io/getting-started/tutorials/react/4-graphql-operations)).
- **Permissions:** the agent writes the rules per role and operation (see the `database` skill: owner column preset from `X-Hasura-User-Id`, own-row filters, nothing for `public`). The user enters them via the table's **…** menu → **Edit Permissions**.
- The frontend code is the same as for a local project, except for the subdomain and region.

This doesn't create migration files in the repo. If the user later installs Docker, `nhost init --remote` pulls the project's schema and metadata into `nhost/` ([Cloud development](https://docs.nhost.io/platform/cli/cloud-development)).

## 3. Go live: deploy a local project to Nhost Cloud

1. The user creates a project (section 1). Optionally, they run `nhost login` and `nhost link` in their own terminal to link the local folder to it ([Local development → Deploy](https://docs.nhost.io/platform/cli/local-development)).
2. In the project dashboard, open **Settings → Deployments → Connect to GitHub** and choose the repository, base directory and deployment branch ([Deployments](https://docs.nhost.io/platform/cloud/deployments)).
3. Push to the deployment branch, after confirming with the user. Nhost deploys `nhost.toml`, new migrations, GraphQL metadata and functions. Progress and logs are in the project's **Deployments** tab.
4. Values that come from `.secrets` locally must exist as secrets in the Cloud project ([Secrets](https://docs.nhost.io/platform/cloud/secrets)).
5. Point the production frontend at the Cloud subdomain and region, and add the production URL to the allowed redirect URLs.
