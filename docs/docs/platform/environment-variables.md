---
title: 'Environment Variables'
sidebar_position: 9
image: /img/og/platform/environment-variables.png
---

Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys.

You can manage your app's environment variables in Nhost Console under **Variables**. When you define a new variable, you can set one value for **production** and one for **development**.

![Environment Variables](/img/platform/environment-variables/environment-variables.png)

When an environment variable is changed, you must deploy your app again using the [GitHub integration](/platform/github-integration) for the changes to take effect.

Environment Variables are available in:

- Hasura
- Serverless Functions

## System Environment Variables

System environment variables are automatically available in production and during development. The following system environment variables are available:

- `NHOST_ADMIN_SECRET`
- `NHOST_WEBHOOK_SECRET`
- `NHOST_JWT_SECRET`
- `NHOST_BACKEND_URL`

Example values:

```bash
NHOST_ADMIN_SECRET=e7w36ag287qn5qry795f6ymm57qgvqup
NHOST_WEBHOOK_SECRET=ns3sfjgdw4y6zeqthwnnw347dzh8wyj4
NHOST_JWT_SECRET={"type": "HS256", "key": "vumpbe2w2mgaqj5yqfp7dvxu6kywtvsgb68ejpdaqxerea8
jwrsszdp2dhkjxsh4df69pzm3ja6ukedx8ja43zdt6q9kgbgg2w9vh2sedeppukud9a2qzy29v3afdn7m"}
NHOST_BACKEND_URL=https://xxxxxxx.nhost.run
```

## Development Environment Variables

When developing locally using the [CLI](/platform/cli), environment variables set in `.env.development` are available in your local environment. There are two ways to manage them:

1. Edit the `.env.development` file manually.
2. Add development environment variables in the Nhost Console and use `nhost env pull` to sync them. This way, your team members will also have access to the same variables.
