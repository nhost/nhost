---
title: 'GitHub integration'
sidebar_position: 10
---

You can connect your Nhost app to a GitHub repository. When you do this, any updates you push to your code will automatically be deployed.

---

## Production branch

Nhost will only deploy your production branch. By default this will match the default branch set on GitHub (usually `main`). You can change this option on Nhost Console.

Specifically, the following will be deployed:

- Database migrations
- Hasura metadata
- Serverless functions

---

## Workflow

Create a new Nhost app. Then use [Nhost CLI](/platform/cli) to initialize your Nhost app locally.

The workflow is as follows:

1. Make local changes (migrations, metadata, functions)
2. Push changes to GitHub
3. Nhost automatically applies changes to production

**You should always follow this workflow.** Never change things in production directly because that will make the local and production state to be out of sync.

### Local and production branches out of sync

If you do changes directly in your production backend, say you add a new table in production, your migrations in your repository will be out of sync. In such a case, we recommend to start over with `nhost init --remote` to get into a consistent state.
