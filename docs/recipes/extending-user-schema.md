# Extending user schema

Adding columns to the user tables may be tempting. However, all the tables and columns have a specific purpose, and changing the structure of the `auth` schema will very likely end in breaking the functionning of Hasura Auth. It's, therefore, **highly recommended** not to modify the database schema for any tables in the `auth` schema.

Instead, we recommend adding extra user information in the following ways:

- to store information in the `auth.users.metadata` column
- to store information in a separate table located in the `public` PostgreSQL schema, and to point to `auth.users.id` through a foreign key.

## `metadata` user field

The `auth.users.metadata` field is a JSON column, that can be used as an option on registration:

```json
{
  "email": "bob@bob.com",
  "passord": "12345678",
  "options": {
    "metadata": {
      "first_name": "Bob"
    }
  }
}
```

## Additional user information in the `public` schema

As previously explained, the alteration of the `auth` schema may seriously hamper the functionning of Hasura Auth. The `metadata` field in the `auth.users` table may tackle some use cases, but in some other cases, we want to keep a certain level of structure in the way data is structured.

In that case, it is possible to create a dedicated table in the `public` schema, with a `user_id` foreign key column that would point to the `auth.users.id` column. It is then possible to add an Hasura object relationship that would join the two tables together.

<!-- TODO hooks on the metadata field -->

---
