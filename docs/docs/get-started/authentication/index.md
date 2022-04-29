---
title: 'Authenticate users'
slug: /get-started/authentication
---

In the previous section, you defined `select` permissions for the `public` role. You will now add `insert` and `select` permissions for authenticated users to secure your app's GraphQL API with authentication.

> Nhost's authentication service lets you deliver frictionless registration and login experiences to your users. We support most social providers and different methods such as email & password and passwordless (magic link).

---

## Insert a test user

Manually create a user by going to your app's **Users** tab (top menu) and clicking on **Add User**.

<video width="99%" loop="" muted="" playsInline="" controls="true">
  <source src="/videos/add-user.mp4" type="video/mp4" />
</video>

You will now use that newly created user. We'll use this newly created user to make authenticated requests to the GraphQL API.

---

## Sign in and query data

Add the following code to sign in the new user and request the list of todos again:

```js
import { NhostClient } from '@nhost/nhost-js';

const nhost = new NhostClient({
  backendUrl: 'https://[app-subdomain].nhost.run',
})(async () => {
  // Sign in user
  const signInResponse = await nhost.auth.signIn({
    email: 'joe@example.com',
    password: 'securepassword',
  });

  // Handle sign-in error
  if (signInResponse.error) {
    throw signInResponse.error;
  }

  // Get todos
  const todos = await nhost.graphql.request(`
    query {
      todos {
        id
        created_at
        name
        is_completed
      }
    }
  `);

  console.log(JSON.stringify(todos.data, null, 2));
})();
```

Why is the return value `null`? Because when making GraphQL requests as an authenticated user, the `user` role is assumed.

> For authenticated requests, there is always the option to override the default `user` role with any other valid role.

To prepare our database and GraphQL API to work for signed-in users we need to do two things:

1. Add a `user_id` column to the `todos` table, so we know what todo belongs to which user.
2. Use the `user` role instead of the `public` role for permissions.

## Add `user_id` column

Before adding the `user_id` column, let's delete all existing todos.

Then add the `user_id` column as a `UUID` type. Make sure that `nullable` is **not** checked. This will ensure that all todos must have a `user_id` value.

At last, we'll create a connection between the `todos` table and the `users` table. For that, we need to do yet another two things:

1. Create a Foreign Key (FK) between `todos` and `auth.users.id`.
2. Let Hasura track the relationship between the two tables.

<video width="99%" loop="" muted="" playsInline="" controls="true">
  <source src="/videos/user-id-column.mp4" type="video/mp4" />
</video>

### Create FK

Create a FK between the `auth.users.id` column and the `public.todos.user_id` column. See video above.

### Track relationship

Click on the `public` schema and track the untracked foreign key relationship. Then click on the `auth` schema and track the relationship again. See video above.

We track these relationships to create the GrpahQL relationships between the `todos` table to the `users` table and the `users` table to the `todos` table.

Ok, our `user_id` column is added and connected correctly. Let's continue with setting permissions for signed-in users.

## Permissions for signed-in users

Let us organize the permissions so it works for signed in users too.

### Remove permissions for the public role

We won't use the `public` role anymore, so let's remove all permission for that role.

![Remove public permissions from Hasura](/img/quick-start/remove-public-permissions.png)

Now we'll add permissions for the `user` role.

> Signed-in users use the `user` role by default

### Insert permission

First, we'll set the **Insert permission**.

A user can only insert `name` because all other columns will be set automatically. More specifically, `user_id` is set to the user's id making the request (`x-hasura-user-id`) and is configured in the `Column presets` section. See the image below.

![User insert permission](/img/quick-start/user-insert-permission.png)

### Select permission

For **Select permission**, set a **custom check** so users can only select todos where `user_id` is the same as their user id. In other words: users are only allowed to select their own todos. See the image below.

![User select permission](/img/quick-start/user-select-permission.png)

Now rerun the app. New todos are inserted, and only todos for the user are fetched and displayed. Your backend is successfully secured!
