---
title: 'Local changes'
---

Start Nhost locally:

```bash
nhost dev
```

:::tip
Make sure you have [Docker](https://www.docker.com/get-started) installed on your computer. It’s required for Nhost to work.
:::

The `nhost dev` command will automatically start a complete Nhost environment locally on your computer using:

- Postgres
- Hasura
- Authentication
- Storage
- Serverless Functions
- Mailhog

You use this local environment to do changes and testing before you deploy your changes to production.

Running `nhost dev` also starts the Hasura Console.

> 💡 It’s important that you use the Hasura Console that is started automatically when you do changes. This way, changes are automatically tracked for you.

![Hasura Console](/img/cli-workflow/hasura-console.png)

In the Hasura Console, create a new table `customers` with two columns:

- id
- name

<Video src="/videos/cli-workflow/hasura-create-customers-table.mp4">
</Video>

When we created the `customers` table there was also a migration created automatically. The migration was created at under `nhost/migrations/default`.

```bash
$ ls -la nhost/migrations/default
total 0
drwxr-xr-x  3 eli  staff   96 Feb  7 16:19 .
drwxr-xr-x  3 eli  staff   96 Feb  7 16:19 ..
drwxr-xr-x  4 eli  staff  128 Feb  7 16:19 1644247179684_create_table_public_customers
```

This database migration has only been applied locally, meaning, you created the `customers` table locally but it does not (yet) exists in production.

To apply the local change to production we need to commit the changes and push it to GitHub. Nhost will then automatically pick up the change in the repository and apply the changes.

:::tip
You can commit and push files in another terminal while still having `nhost dev` running.
:::

```bash
git add -A
git commit -m "Initialized Nhost and added a customers table"
git push
```

Head over to the **Deployments** tab in the **Nhost console** to see the deployment.

![Deployments tab after changes](/img/cli-workflow/deployments-tab-with-changes.png)

Once the deployment finishes the `customers` table is created in production.

![Customers table in Hasura Console](/img/cli-workflow/hasura-customers-table.png)

We’ve now completed the recommended workflow with Nhost:

1. Develop locally using the Nhost CLI.
2. Push changes to GitHub.
3. Nhost deploys changes to production.
