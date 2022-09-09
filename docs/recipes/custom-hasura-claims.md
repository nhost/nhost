# Custom Hasura JWT claims

Hasura comes with a [powerful authorisation system](https://hasura.io/docs/latest/graphql/core/auth/authorization/index.html). Hasura Auth is already configured to add `x-hasura-user-id`, `x-hasura-allowed-roles`, and `x-hasura-user-isAnonymous` to the JSON Web Tokens it generates.

In Hasura Auth, it is possible to define custom claims to add to the JWT, so they can be used by Hasura to determine the permissions of the received GraphQL operation.

Each custom claim is defined by a pair of a key and a value:

- The key determines the name of the claim, prefixed by `x-hasura`. For instance, `organisation-id` will become `x-hasura-organisation-id`.
- The value is a representation of the path to look at to determine the value of the claim. For instance `profile.organisation.id` will look for the `user.profile` Hasura relationship, and the `profile.organisation` Hasura relationship. Array values are transformed into Postgres syntax so Hasura can interpret them. See the official Hasura documentation to understand the [session variables format](https://hasura.io/docs/latest/graphql/core/auth/authorization/roles-variables.html#format-of-session-variables).

```bash
AUTH_JWT_CUSTOM_CLAIMS={"organisation-id":"profile.organisation[].id", "project-ids":"profile.contributesTo[].project.id"}
```

Will automatically generate and fetch the following GraphQL query:

```graphql
{
  user(id: "<user-id>") {
    profile {
      organisation {
        id
      }
      contributesTo {
        project {
          id
        }
      }
    }
  }
}
```

It will then use the same expressions e.g. `profile.contributesTo[].project.id` to evaluate the result with [JSONata](https://jsonata.org/), and possibly transform arrays into Hasura-readable, PostgreSQL arrays.Finally, it adds the custom claims to the JWT in the `https://hasura.io/jwt/claims` namespace:

```json
{
  "https://hasura.io/jwt/claims": {
    "x-hasura-organisation-id": "8bdc4f57-7d64-4146-a663-6bcb05ea2ac1",
    "x-hasura-project-ids": "{\"3af1b33f-fd0f-425e-92e2-0db09c8b2e29\",\"979cb94c-d873-4d5b-8ee0-74527428f58f\"}",
    "x-hasura-allowed-roles": [ "me", "user" ],
    "x-hasura-default-role": "user",
    "x-hasura-user-id": "121bbea4-908e-4540-ac5d-52c7f6f93bec",
    "x-hasura-user-isAnonymous": "false"
  }
  "sub": "f8776768-4bbd-46f8-bae1-3c40da4a89ff",
  "iss": "hasura-auth",
  "iat": 1643040189,
  "exp": 1643041089
}
```
