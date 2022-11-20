## Get column types from generated GrapQL for Hasura event triggers

We could infer the column types from generated types:

```ts
type OmitNever<T> = { [K in keyof T as T[K] extends never | never[] | undefined ? never : K]: T[K] }

type WithoutRelationships<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends
    | {
        data: any
        on_conflict?: { constraint: any; update_columns?: any[]; where?: any } | null
      }
    | undefined
    | null
    ? never
    : T[K]
}

type ColumnsTypesFrom<T extends Record<string, any>> = OmitNever<WithoutRelationships<T>>

type UserColumns = ColumnsTypesFrom<UsersInsertInput>
```

In the above example, it would create a type that would match with the Users type.
The problem is, the column names and types in the Hasura Event payload are the ones from Postgres, while the above is from GraphQL.

As
