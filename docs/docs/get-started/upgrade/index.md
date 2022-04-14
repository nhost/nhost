---
title: 'Upgrade from v1 to v2'
---

Upgrading from Nhost v1 to v2 requires database schema and Hasura metadata changes.

---

## Upgrade Steps

### Create a new Nhost v2 app locally

:::tip
Make sure you have the [Nhost CLI](/reference/cli) installed
:::

```bash
nhost init my-nhost-v2-app
cd my-nhost-v2-app
```

### Update config

Update `version: 3` to `version: 2` in `nhost/config.yaml`. This will update Hasura's configuration version, and we need to downgrade the version when we export migrations and metadata.

### Export current migrations and metadata from Nhost v1

Inside the `nhost/` folder of your app, run:

```bash
hasura migrate create init --from-server --endpoint=[v1-endpoint] --admin-secret=[v1-admin-secret]

hasura metadata export --endpoint=[v1-endpoint] --admin-secret=[v1-admin-secret]
```

### Update Migrations

Make the following changes manually to your migrations.

:::tip
The migration file is located at `nhost/migrations/[timestamp]/up.sql`.
:::

- Add `OR REPLACE` after `CREATE` for the `public.set_current_timestamp_updated_at` function
- Delete all `auth.*` tables and functions (if any).
- Delete `public.users` table and everything related to the table such as constraints, triggers, etc.
- Update FK references from `public.users` to `auth.users` (if any).

### Update Metadata

Make the following changes manually to your metadata.

:::tip
The metadata is located at `nhost/metadata/tables.yaml`.
:::

- Delete tracking all tables in the `auth` schema.
- Delete tracking the `public.users` table.
- Update all references to `users` from the `public` to `auth` schema.

### Start nhost

Start Nhost locally using the [CLI](/reference/cli). From the root of your app, run:

```bash
nhost -d
```

:::tip
Running Nhost applies your local database migrations and Hasura metadata.
:::

### Restart Auth and Storage containers

Open Docker UI and restart Hasura Auth and Hasura Storage. Restarting those containers applies new metadata, effectively tracking everything in the `auth` and the `storage` schema.

### Delete migrations and metadata

Delete the local migrations and metadata.

```bash
rm -rf nhost/migrations nhost/metadata
```

### Update config (again)

Update `config: 2` to `config: 3` in `nhost/config.yaml`.

### Pull migrations and metadata from our local instance

:::tip
You can not use port `1337` in these requests. You have to use the specific port Huasra uses. Go to the Hasura Console under API and look for the port Hasura is using under GraphQL Endpoint.
:::

```bash
hasura migrate create init --from-server --endpoint=http://localhost:[hasura-port] --admin-secret=nhost-admin-secret
hasura metadata export --from-server --endpoint=http://localhost:[hasura-port] --admin-secret=nhost-admin-secret
```

### Done

You now have a Nhost v2 project locally with correct migrations and metadata. Happy hacking!
