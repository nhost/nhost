---
sidebar_position: 4
---

# GraphQL

Nhost automatically generates a GraphQL API based on your tables and columns in your [Postgres database](/database). This is made possible by [Hasura's GraphQL Engine](https://github.com/hasura/graphql-engine).

Everytime the database schema changes it instantly gets reflected in your GraphQL API.

## What is GraphQL?

GraphQL is a query language that prioritizes developer experience. With a GraphQL API, clients can get exactly the data they request and no more. GraphQL is also designed to make APIs fast, flexible, and developer-friendly.

Some popular clients to communicate between your frontend (or backend) and GraphQL API are:

- [Apollo Client](https://www.apollographql.com/docs/react/)
- [React Query](https://react-query.tanstack.com/graphql)
- [URQL](https://formidable.com/open-source/urql/)
- [GraphQL Request](https://github.com/prisma-labs/graphql-request)
- [SWR](https://swr.vercel.app/docs/data-fetching#graphql)

---

## GraphQL Query

A GraphQL query is used to fetch data from the database.

**Example:** Fetch movies

```graphql
query {
  movies {
    id
    name
  }
}
```

**Response:**

```json
{
  "data": {
    "movies": [
      {
        "id": 1,
        "name": "The Dark Knight"
      },
      {
        "id": 2,
        "name": "The Godfather"
      },
      {
        "id": 3,
        "name": "Fight Club"
      },
      {
        "id": 4,
        "name": "Forrest Gump"
      }
    ]
  }
}
```

Read more about GraphQL Queries in [Hasura's documentation for GraphQL queries](https://hasura.io/docs/latest/graphql/core/databases/postgres/queries/index/).

## GraphQL Mutation

A GraphQL mutation is used to insert, update or delete data from the database.

### Insert Data

GraphQL mutation to insert data looks like this:

```graphql
mutation InsertTodo {
  insert_todos(
    objects: [
      {
        title: "Delete Firebase account"
        body: "Migrate to nhost.io"
        done: false
      }
    ]
  ) {
    returning {
      id
      title
      body
      done
    }
  }
}
```

Response:

```json
{
  "data": {
    "insert_todos": [
      {
        "id": "bf4b01ec-8eb6-451b-afac-81f5058ce852",
        "title": "Delete Firebase account",
        "body": "Migrate to nhost.io",
        "done": true
      }
    ]
  }
}
```

It's recommended to add the whole object as a variable to the GraphQL mutation. This way, you don't have to modify the GraphQL mutation in the future if you add extra fields.

**Recommended:**

```graphql
mutation insertMovie($movie: movies_insert_input!) {
  insert_movies_one(object: $movie) {
    id
  }
}
```

**Not recommended:**

```graphql
mutation insertMovie($name: string!) {
  insert_movies_one(object: { name: $name }) {
    id
  }
}
```

### Inserting multiple rows

Multiple rows can be inserted with an array as the objects property. This can be useful for migrating data.

```graphql
mutation InsertMultipleTodos {
  insert_todos(
    objects: [
      {
        title: "Build the front end"
        body: "Mobile app or website first?"
        done: false
      }
      { title: "Launch 🚀", body: "That was easy", done: false }
    ]
  ) {
    returning {
      id
      title
      body
      done
    }
  }
}
```

---

## Updating data

You can update existing data with an update mutation. You can update multiple rows at once.

To mark a todo as done, you would use a mutation like this:

```graphql
mutation UpdateTodoStatus($id: uuid, $done: Boolean) {
  update_todos(_set: { done: $done }, where: { id: { _eq: $id } }) {
    returning {
      body
      done
      title
    }
  }
}
```

Notice how we are using variables as the `id` and `done` variables, which lets us mark any todo as done or not done with the same mutation.

### Upsert

When you're not sure if a piece of data already exists, use an upsert mutation. It will either insert an object into the database if it doesn't exist, or update the fields of an existing object.

Unlike for update mutations, you must pass all columns to an upsert mutation.

In order to convert your insert mutation to an upsert, you need to add an `on_conflict` property. This tells Hasura which fields it should use to find duplicates.

The `on_conflict` key must be a unique key in your database:

```graphql
mutation UpsertTodo {
  insert_todos(
    objects: { title: "Delete Firebase account", body: "...", done: false }
    on_conflict: { constraint: todos_title_key, update_columns: [title, done] }
  ) {
    returning {
      id
      title
      body
      done
    }
  }
}
```

This will update the body and done properties of the todo titled `"Delete Firebase account"`.

### Conditional upsert

Inserts a new object into a table, or if the primary key already exists, updates columns if the `where` condition is met.

For example, you may want to only update an existing todo if it is not done:

```graphql
mutation UpsertTodo {
  insert_todos(
    objects: { title: "Delete Firebase account", body: "...", done: false }
    on_conflict: {
      constraint: todos_title_key
      update_columns: [body, done]
      where: { done: { _eq: false } }
    }
  ) {
    returning {
      body
      done
      id
      title
    }
  }
}
```

### Ignore mutation on conflict

If `update_columns` is empty, the mutation will be ignored if the object already exists.

Here we have set the `title` to a unique key, to prevent multiple tasks with the same name. We want to avoid overwriting existing todos, so the update_columns array is empty:

```graphql
mutation InsertTodo {
  insert_todos(
    objects: { title: "Delete Firebase account", body: "...", done: false }
    on_conflict: { constraint: todos_title_key, update_columns: [] }
  ) {
    returning {
      body
      done
      id
      title
    }
  }
}
```

In this case, the insert mutation is ignored because a todo with the `title` `"Delete Firebase account"` already exists, and `update_columns` is empty.

---

## Deleting data

To delete your data, use a delete mutation. This mutation will delete all `todos` where `done` is `true`:

```graphql
mutation DeleteDoneTodos {
  delete_todos(where: { done: { _eq: true } }) {
    affected_rows
  }
}
```

If you have set up foreign keys which will restrict a delete violation, you will get an error and will not be able to delete the data until all violations are solved. The simplest way to solve this is by set `On Delete Violation` to `CASCADE` when you set up a foreign Key.

---

## Subscriptions

GraphQL subscriptions are queries that use WebSockets to keep the data up to date in your app in real time:

```graphql
subscription GetTodos {
  todos {
    title
    body
    done
  }
}
```

Your data is always in sync when using subscriptions. It does not matter if the data changes through GraphQL or directly in the database. The data is always syncing in real-time using GraphQL subscriptions.
