---
title: 'Set permissions'
---

While using the Hasura Console, you could fetch the todos because the **admin** role is enabled by default but when building your applications with a client, you want to define permissions using **roles** that your users can assume when making requests.

Hasura supports role-based access control. You create rules for each role, table, and operation (select, insert, update and delete) that can check dynamic session variables, like user ID.

## Unauthenticated users

Use the `public` role in permissions when you want some data to be accessed by anyone without being signed in. The `public` role is the default role in all unauthenticated requests.

Generally speaking, the `public` role should not have insert, update or delete permissions defined.

### Setting `public` permissions

In Hasura Console, go to the **Data** tab, click on the **todos** table, then click **Permissions**. Add a new role called `public` and click on **select**. The permission options for the select operation show up below.

Add the following permissions:

![Public role](/img/quick-start/permissions-public-select.png)

Rerun the program. Now you see all todos.

```bash
➜ node index.js

{
  "todos": [
    {
      "id": "558b9754-bb18-4abd-83d9-e9056934e812",
      "created_at": "2021-12-01T17:05:09.311362+00:00",
      "name": "write docs",
      "is_completed": false
    },
    {
      "id": "480369c8-6f57-4061-bfdf-9ead647e10d3",
      "created_at": "2021-12-01T17:05:20.5693+00:00",
      "name": "cook dinner",
      "is_completed": true
    }
  ]
}
```

---

There are two reasons why the request succeeded:

1. Nhost sets the `public` role for every unauthenticated GraphQL request.
2. You explicitly defined permissions for the `public` role.

It is essential to understand that Hasura has an **allow nothing by default** policy to ensure that only roles and permissions you define explicitly have access to the GraphQL API.
