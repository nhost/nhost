/**
 * GQTY AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> }
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> }
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  timestamptz: any
  uuid: any
}

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export interface Boolean_comparison_exp {
  _eq?: InputMaybe<Scalars['Boolean']>
  _gt?: InputMaybe<Scalars['Boolean']>
  _gte?: InputMaybe<Scalars['Boolean']>
  _in?: InputMaybe<Array<Scalars['Boolean']>>
  _is_null?: InputMaybe<Scalars['Boolean']>
  _lt?: InputMaybe<Scalars['Boolean']>
  _lte?: InputMaybe<Scalars['Boolean']>
  _neq?: InputMaybe<Scalars['Boolean']>
  _nin?: InputMaybe<Array<Scalars['Boolean']>>
}

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export interface String_comparison_exp {
  _eq?: InputMaybe<Scalars['String']>
  _gt?: InputMaybe<Scalars['String']>
  _gte?: InputMaybe<Scalars['String']>
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']>
  _in?: InputMaybe<Array<Scalars['String']>>
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']>
  _is_null?: InputMaybe<Scalars['Boolean']>
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']>
  _lt?: InputMaybe<Scalars['String']>
  _lte?: InputMaybe<Scalars['String']>
  _neq?: InputMaybe<Scalars['String']>
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']>
  _nin?: InputMaybe<Array<Scalars['String']>>
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']>
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']>
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']>
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']>
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']>
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']>
}

/** column ordering options */
export enum order_by {
  /** in ascending order, nulls last */
  asc = 'asc',
  /** in ascending order, nulls first */
  asc_nulls_first = 'asc_nulls_first',
  /** in ascending order, nulls last */
  asc_nulls_last = 'asc_nulls_last',
  /** in descending order, nulls first */
  desc = 'desc',
  /** in descending order, nulls first */
  desc_nulls_first = 'desc_nulls_first',
  /** in descending order, nulls last */
  desc_nulls_last = 'desc_nulls_last'
}

/** order by aggregate values of table "posts" */
export interface posts_aggregate_order_by {
  count?: InputMaybe<order_by>
  max?: InputMaybe<posts_max_order_by>
  min?: InputMaybe<posts_min_order_by>
}

/** Boolean expression to filter rows from the table "posts". All fields are combined with a logical 'AND'. */
export interface posts_bool_exp {
  _and?: InputMaybe<Array<posts_bool_exp>>
  _not?: InputMaybe<posts_bool_exp>
  _or?: InputMaybe<Array<posts_bool_exp>>
  created_at?: InputMaybe<timestamptz_comparison_exp>
  id?: InputMaybe<uuid_comparison_exp>
  is_public?: InputMaybe<Boolean_comparison_exp>
  title?: InputMaybe<String_comparison_exp>
  updated_at?: InputMaybe<timestamptz_comparison_exp>
  user?: InputMaybe<users_bool_exp>
  user_id?: InputMaybe<uuid_comparison_exp>
}

/** unique or primary key constraints on table "posts" */
export enum posts_constraint {
  /** unique or primary key constraint on columns "id" */
  posts_pkey = 'posts_pkey'
}

/** input type for inserting data into table "posts" */
export interface posts_insert_input {
  is_public?: InputMaybe<Scalars['Boolean']>
  title?: InputMaybe<Scalars['String']>
}

/** order by max() on columns of table "posts" */
export interface posts_max_order_by {
  created_at?: InputMaybe<order_by>
  id?: InputMaybe<order_by>
  title?: InputMaybe<order_by>
  updated_at?: InputMaybe<order_by>
  user_id?: InputMaybe<order_by>
}

/** order by min() on columns of table "posts" */
export interface posts_min_order_by {
  created_at?: InputMaybe<order_by>
  id?: InputMaybe<order_by>
  title?: InputMaybe<order_by>
  updated_at?: InputMaybe<order_by>
  user_id?: InputMaybe<order_by>
}

/** on_conflict condition type for table "posts" */
export interface posts_on_conflict {
  constraint: posts_constraint
  update_columns?: Array<posts_update_column>
  where?: InputMaybe<posts_bool_exp>
}

/** Ordering options when selecting data from "posts". */
export interface posts_order_by {
  created_at?: InputMaybe<order_by>
  id?: InputMaybe<order_by>
  is_public?: InputMaybe<order_by>
  title?: InputMaybe<order_by>
  updated_at?: InputMaybe<order_by>
  user?: InputMaybe<users_order_by>
  user_id?: InputMaybe<order_by>
}

/** primary key columns input for table: posts */
export interface posts_pk_columns_input {
  id: Scalars['uuid']
}

/** select columns of table "posts" */
export enum posts_select_column {
  /** column name */
  created_at = 'created_at',
  /** column name */
  id = 'id',
  /** column name */
  is_public = 'is_public',
  /** column name */
  title = 'title',
  /** column name */
  updated_at = 'updated_at',
  /** column name */
  user_id = 'user_id'
}

/** input type for updating data in table "posts" */
export interface posts_set_input {
  is_public?: InputMaybe<Scalars['Boolean']>
  title?: InputMaybe<Scalars['String']>
}

/** update columns of table "posts" */
export enum posts_update_column {
  /** column name */
  is_public = 'is_public',
  /** column name */
  title = 'title'
}

export interface posts_updates {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<posts_set_input>
  where: posts_bool_exp
}

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export interface timestamptz_comparison_exp {
  _eq?: InputMaybe<Scalars['timestamptz']>
  _gt?: InputMaybe<Scalars['timestamptz']>
  _gte?: InputMaybe<Scalars['timestamptz']>
  _in?: InputMaybe<Array<Scalars['timestamptz']>>
  _is_null?: InputMaybe<Scalars['Boolean']>
  _lt?: InputMaybe<Scalars['timestamptz']>
  _lte?: InputMaybe<Scalars['timestamptz']>
  _neq?: InputMaybe<Scalars['timestamptz']>
  _nin?: InputMaybe<Array<Scalars['timestamptz']>>
}

/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
export interface users_bool_exp {
  _and?: InputMaybe<Array<users_bool_exp>>
  _not?: InputMaybe<users_bool_exp>
  _or?: InputMaybe<Array<users_bool_exp>>
  displayName?: InputMaybe<String_comparison_exp>
  id?: InputMaybe<uuid_comparison_exp>
  posts?: InputMaybe<posts_bool_exp>
}

/** Ordering options when selecting data from "auth.users". */
export interface users_order_by {
  displayName?: InputMaybe<order_by>
  id?: InputMaybe<order_by>
  posts_aggregate?: InputMaybe<posts_aggregate_order_by>
}

/** select columns of table "auth.users" */
export enum users_select_column {
  /** column name */
  displayName = 'displayName',
  /** column name */
  id = 'id'
}

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export interface uuid_comparison_exp {
  _eq?: InputMaybe<Scalars['uuid']>
  _gt?: InputMaybe<Scalars['uuid']>
  _gte?: InputMaybe<Scalars['uuid']>
  _in?: InputMaybe<Array<Scalars['uuid']>>
  _is_null?: InputMaybe<Scalars['Boolean']>
  _lt?: InputMaybe<Scalars['uuid']>
  _lte?: InputMaybe<Scalars['uuid']>
  _neq?: InputMaybe<Scalars['uuid']>
  _nin?: InputMaybe<Array<Scalars['uuid']>>
}

export const scalarsEnumsHash: import('gqty').ScalarsEnumsHash = {
  Boolean: true,
  Int: true,
  String: true,
  order_by: true,
  posts_constraint: true,
  posts_select_column: true,
  posts_update_column: true,
  timestamptz: true,
  users_select_column: true,
  uuid: true
}
export const generatedSchema = {
  Boolean_comparison_exp: {
    _eq: { __type: 'Boolean' },
    _gt: { __type: 'Boolean' },
    _gte: { __type: 'Boolean' },
    _in: { __type: '[Boolean!]' },
    _is_null: { __type: 'Boolean' },
    _lt: { __type: 'Boolean' },
    _lte: { __type: 'Boolean' },
    _neq: { __type: 'Boolean' },
    _nin: { __type: '[Boolean!]' }
  },
  String_comparison_exp: {
    _eq: { __type: 'String' },
    _gt: { __type: 'String' },
    _gte: { __type: 'String' },
    _ilike: { __type: 'String' },
    _in: { __type: '[String!]' },
    _iregex: { __type: 'String' },
    _is_null: { __type: 'Boolean' },
    _like: { __type: 'String' },
    _lt: { __type: 'String' },
    _lte: { __type: 'String' },
    _neq: { __type: 'String' },
    _nilike: { __type: 'String' },
    _nin: { __type: '[String!]' },
    _niregex: { __type: 'String' },
    _nlike: { __type: 'String' },
    _nregex: { __type: 'String' },
    _nsimilar: { __type: 'String' },
    _regex: { __type: 'String' },
    _similar: { __type: 'String' }
  },
  mutation: {
    __typename: { __type: 'String!' },
    deletePost: { __type: 'posts', __args: { id: 'uuid!' } },
    deletePosts: { __type: 'posts_mutation_response', __args: { where: 'posts_bool_exp!' } },
    insertPost: {
      __type: 'posts',
      __args: { object: 'posts_insert_input!', on_conflict: 'posts_on_conflict' }
    },
    insertPosts: {
      __type: 'posts_mutation_response',
      __args: { objects: '[posts_insert_input!]!', on_conflict: 'posts_on_conflict' }
    },
    updatePost: {
      __type: 'posts',
      __args: { _set: 'posts_set_input', pk_columns: 'posts_pk_columns_input!' }
    },
    updatePosts: {
      __type: 'posts_mutation_response',
      __args: { _set: 'posts_set_input', where: 'posts_bool_exp!' }
    },
    update_posts_many: {
      __type: '[posts_mutation_response]',
      __args: { updates: '[posts_updates!]!' }
    }
  },
  posts: {
    __typename: { __type: 'String!' },
    created_at: { __type: 'timestamptz!' },
    id: { __type: 'uuid!' },
    is_public: { __type: 'Boolean!' },
    title: { __type: 'String!' },
    updated_at: { __type: 'timestamptz!' },
    user: { __type: 'users!' },
    user_id: { __type: 'uuid!' }
  },
  posts_aggregate_order_by: {
    count: { __type: 'order_by' },
    max: { __type: 'posts_max_order_by' },
    min: { __type: 'posts_min_order_by' }
  },
  posts_bool_exp: {
    _and: { __type: '[posts_bool_exp!]' },
    _not: { __type: 'posts_bool_exp' },
    _or: { __type: '[posts_bool_exp!]' },
    created_at: { __type: 'timestamptz_comparison_exp' },
    id: { __type: 'uuid_comparison_exp' },
    is_public: { __type: 'Boolean_comparison_exp' },
    title: { __type: 'String_comparison_exp' },
    updated_at: { __type: 'timestamptz_comparison_exp' },
    user: { __type: 'users_bool_exp' },
    user_id: { __type: 'uuid_comparison_exp' }
  },
  posts_insert_input: { is_public: { __type: 'Boolean' }, title: { __type: 'String' } },
  posts_max_order_by: {
    created_at: { __type: 'order_by' },
    id: { __type: 'order_by' },
    title: { __type: 'order_by' },
    updated_at: { __type: 'order_by' },
    user_id: { __type: 'order_by' }
  },
  posts_min_order_by: {
    created_at: { __type: 'order_by' },
    id: { __type: 'order_by' },
    title: { __type: 'order_by' },
    updated_at: { __type: 'order_by' },
    user_id: { __type: 'order_by' }
  },
  posts_mutation_response: {
    __typename: { __type: 'String!' },
    affected_rows: { __type: 'Int!' },
    returning: { __type: '[posts!]!' }
  },
  posts_on_conflict: {
    constraint: { __type: 'posts_constraint!' },
    update_columns: { __type: '[posts_update_column!]!' },
    where: { __type: 'posts_bool_exp' }
  },
  posts_order_by: {
    created_at: { __type: 'order_by' },
    id: { __type: 'order_by' },
    is_public: { __type: 'order_by' },
    title: { __type: 'order_by' },
    updated_at: { __type: 'order_by' },
    user: { __type: 'users_order_by' },
    user_id: { __type: 'order_by' }
  },
  posts_pk_columns_input: { id: { __type: 'uuid!' } },
  posts_set_input: { is_public: { __type: 'Boolean' }, title: { __type: 'String' } },
  posts_updates: { _set: { __type: 'posts_set_input' }, where: { __type: 'posts_bool_exp!' } },
  query: {
    __typename: { __type: 'String!' },
    posts: {
      __type: '[posts!]!',
      __args: {
        distinct_on: '[posts_select_column!]',
        limit: 'Int',
        offset: 'Int',
        order_by: '[posts_order_by!]',
        where: 'posts_bool_exp'
      }
    },
    posts_by_pk: { __type: 'posts', __args: { id: 'uuid!' } },
    user: { __type: 'users', __args: { id: 'uuid!' } },
    users: {
      __type: '[users!]!',
      __args: {
        distinct_on: '[users_select_column!]',
        limit: 'Int',
        offset: 'Int',
        order_by: '[users_order_by!]',
        where: 'users_bool_exp'
      }
    }
  },
  subscription: {
    __typename: { __type: 'String!' },
    posts: {
      __type: '[posts!]!',
      __args: {
        distinct_on: '[posts_select_column!]',
        limit: 'Int',
        offset: 'Int',
        order_by: '[posts_order_by!]',
        where: 'posts_bool_exp'
      }
    },
    posts_by_pk: { __type: 'posts', __args: { id: 'uuid!' } },
    user: { __type: 'users', __args: { id: 'uuid!' } },
    users: {
      __type: '[users!]!',
      __args: {
        distinct_on: '[users_select_column!]',
        limit: 'Int',
        offset: 'Int',
        order_by: '[users_order_by!]',
        where: 'users_bool_exp'
      }
    }
  },
  timestamptz_comparison_exp: {
    _eq: { __type: 'timestamptz' },
    _gt: { __type: 'timestamptz' },
    _gte: { __type: 'timestamptz' },
    _in: { __type: '[timestamptz!]' },
    _is_null: { __type: 'Boolean' },
    _lt: { __type: 'timestamptz' },
    _lte: { __type: 'timestamptz' },
    _neq: { __type: 'timestamptz' },
    _nin: { __type: '[timestamptz!]' }
  },
  users: {
    __typename: { __type: 'String!' },
    displayName: { __type: 'String!' },
    id: { __type: 'uuid!' },
    posts: {
      __type: '[posts!]!',
      __args: {
        distinct_on: '[posts_select_column!]',
        limit: 'Int',
        offset: 'Int',
        order_by: '[posts_order_by!]',
        where: 'posts_bool_exp'
      }
    }
  },
  users_bool_exp: {
    _and: { __type: '[users_bool_exp!]' },
    _not: { __type: 'users_bool_exp' },
    _or: { __type: '[users_bool_exp!]' },
    displayName: { __type: 'String_comparison_exp' },
    id: { __type: 'uuid_comparison_exp' },
    posts: { __type: 'posts_bool_exp' }
  },
  users_order_by: {
    displayName: { __type: 'order_by' },
    id: { __type: 'order_by' },
    posts_aggregate: { __type: 'posts_aggregate_order_by' }
  },
  uuid_comparison_exp: {
    _eq: { __type: 'uuid' },
    _gt: { __type: 'uuid' },
    _gte: { __type: 'uuid' },
    _in: { __type: '[uuid!]' },
    _is_null: { __type: 'Boolean' },
    _lt: { __type: 'uuid' },
    _lte: { __type: 'uuid' },
    _neq: { __type: 'uuid' },
    _nin: { __type: '[uuid!]' }
  }
} as const

export interface Mutation {
  __typename?: 'Mutation'
  deletePost: (args: { id: Scalars['uuid'] }) => Maybe<posts>
  deletePosts: (args: { where: posts_bool_exp }) => Maybe<posts_mutation_response>
  insertPost: (args: {
    object: posts_insert_input
    on_conflict?: Maybe<posts_on_conflict>
  }) => Maybe<posts>
  insertPosts: (args: {
    objects: Array<posts_insert_input>
    on_conflict?: Maybe<posts_on_conflict>
  }) => Maybe<posts_mutation_response>
  updatePost: (args: {
    _set?: Maybe<posts_set_input>
    pk_columns: posts_pk_columns_input
  }) => Maybe<posts>
  updatePosts: (args: {
    _set?: Maybe<posts_set_input>
    where: posts_bool_exp
  }) => Maybe<posts_mutation_response>
  update_posts_many: (args: {
    updates: Array<posts_updates>
  }) => Maybe<Array<Maybe<posts_mutation_response>>>
}

/**
 * columns and relationships of "posts"
 */
export interface posts {
  __typename?: 'posts'
  created_at: ScalarsEnums['timestamptz']
  id: ScalarsEnums['uuid']
  is_public: ScalarsEnums['Boolean']
  title: ScalarsEnums['String']
  updated_at: ScalarsEnums['timestamptz']
  /**
   * An object relationship
   */
  user: users
  user_id: ScalarsEnums['uuid']
}

/**
 * response of any mutation on the table "posts"
 */
export interface posts_mutation_response {
  __typename?: 'posts_mutation_response'
  /**
   * number of rows affected by the mutation
   */
  affected_rows: ScalarsEnums['Int']
  /**
   * data from the rows affected by the mutation
   */
  returning: Array<posts>
}

export interface Query {
  __typename?: 'Query'
  posts: (args?: {
    distinct_on?: Maybe<Array<posts_select_column>>
    limit?: Maybe<Scalars['Int']>
    offset?: Maybe<Scalars['Int']>
    order_by?: Maybe<Array<posts_order_by>>
    where?: Maybe<posts_bool_exp>
  }) => Array<posts>
  posts_by_pk: (args: { id: Scalars['uuid'] }) => Maybe<posts>
  user: (args: { id: Scalars['uuid'] }) => Maybe<users>
  users: (args?: {
    distinct_on?: Maybe<Array<users_select_column>>
    limit?: Maybe<Scalars['Int']>
    offset?: Maybe<Scalars['Int']>
    order_by?: Maybe<Array<users_order_by>>
    where?: Maybe<users_bool_exp>
  }) => Array<users>
}

export interface Subscription {
  __typename?: 'Subscription'
  posts: (args?: {
    distinct_on?: Maybe<Array<posts_select_column>>
    limit?: Maybe<Scalars['Int']>
    offset?: Maybe<Scalars['Int']>
    order_by?: Maybe<Array<posts_order_by>>
    where?: Maybe<posts_bool_exp>
  }) => Array<posts>
  posts_by_pk: (args: { id: Scalars['uuid'] }) => Maybe<posts>
  user: (args: { id: Scalars['uuid'] }) => Maybe<users>
  users: (args?: {
    distinct_on?: Maybe<Array<users_select_column>>
    limit?: Maybe<Scalars['Int']>
    offset?: Maybe<Scalars['Int']>
    order_by?: Maybe<Array<users_order_by>>
    where?: Maybe<users_bool_exp>
  }) => Array<users>
}

/**
 * User account information. Don't modify its structure as Hasura Auth relies on it to function properly.
 */
export interface users {
  __typename?: 'users'
  displayName: ScalarsEnums['String']
  id: ScalarsEnums['uuid']
  /**
   * An array relationship
   */
  posts: (args?: {
    /**
     * distinct select on columns
     */
    distinct_on?: Maybe<Array<posts_select_column>>
    /**
     * limit the number of rows returned
     */
    limit?: Maybe<Scalars['Int']>
    /**
     * skip the first n rows. Use only with order_by
     */
    offset?: Maybe<Scalars['Int']>
    /**
     * sort the rows by one or more columns
     */
    order_by?: Maybe<Array<posts_order_by>>
    /**
     * filter the rows returned
     */
    where?: Maybe<posts_bool_exp>
  }) => Array<posts>
}

export interface SchemaObjectTypes {
  Mutation: Mutation
  Query: Query
  Subscription: Subscription
  posts: posts
  posts_mutation_response: posts_mutation_response
  users: users
}
export type SchemaObjectTypesNames =
  | 'Mutation'
  | 'Query'
  | 'Subscription'
  | 'posts'
  | 'posts_mutation_response'
  | 'users'

export interface GeneratedSchema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

export type MakeNullable<T> = {
  [K in keyof T]: T[K] | undefined
}

export interface ScalarsEnums extends MakeNullable<Scalars> {
  order_by: order_by | undefined
  posts_constraint: posts_constraint | undefined
  posts_select_column: posts_select_column | undefined
  posts_update_column: posts_update_column | undefined
  users_select_column: users_select_column | undefined
}
