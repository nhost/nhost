---
title: 'Define schema'
---

To implement an app for managing a todo list, let's ensure we have database tables for storing todos and users.

---

## Open Hasura Console

Hasura generates real-time GraphQL APIs, but it also provides a web console for manipulating the schema and data of your database.

Go to the **Data** tab on your app's dashboard and select **Open Hasura**. Remember to copy the admin secret.

The Hasura Console of your app's dedicated Hasura instance will open in a new tab. You can use Hasura Console to manage your app's schema, data, permissions, and event triggers.

![Data -> Open Hasura](/img/quick-start/data-tab.png)

---

## Users table

You should see all your database tables on the left-hand side of the screen. You should see multiple different **schemas** displayed as folders:

- `public` schema for your app's custom tables
- `auth` and `storage` schemas for Nhost's user management and file storage

If you open the `auth` schema, you'll see that your app already has a `users` table, so you don't have to create one.

![To store the users, we already have a users table from the auth schema](/img/quick-start/list-of-schemas.png)

---

## Create todos table

In Hasura Console, go to the **data** tab, then click **Create Table**. Name this table `todos`.

### Add frequently used columns

`id` and `created_at` columns are standard and can be added with two clicks. Click **Frequently used columns** and create them:

- `id` (UUID)
- `created_at` (timestamp)

Using frequently used columns ensures the columns get the right name, type, and default value.

![Frequently used columns in the Hasura console](/img/quick-start/frequently-used-columns.png)

### Add custom columns

Add two more columns manually:

- `name` (text)
- `is_completed` (boolean)

Make sure to set the default value of `is_completed` to `false`.

![Create a table in the Hasura console](/img/quick-start/create-table.png)

This is all we need! A new table will be created when you click **Add Table**.

---

## Insert data

Go to the **Insert Row** tab to add some data to your database.

<video width="99%" loop="" muted="" playsInline="" controls="true">
  <source src="/videos/insert-todos.mp4" type="video/mp4" />
</video>

---

## Query data

Now that we have data in our database, we can retrieve it via a GraphQL API. Go to the **API** tab in the main menu. You can use this view to make GraphQL requests that query or mutate data in your database.

Paste the following GraphQL query into the form and press the "play" button:

```graphql
query {
  todos {
    id
    created_at
    name
    is_completed
  }
}
```

You should see the todos you just inserted show up as output on the right-hand side.

### Admin role

All requests in the Hasura Console use the `admin` role by default. This role has access to all tables and permissions.
