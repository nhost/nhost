export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  timestamptz: any;
  uuid: any;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type StringComparisonExp = {
  _eq?: InputMaybe<Scalars['String']>;
  _gt?: InputMaybe<Scalars['String']>;
  _gte?: InputMaybe<Scalars['String']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']>;
  _in?: InputMaybe<Array<Scalars['String']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']>;
  _lt?: InputMaybe<Scalars['String']>;
  _lte?: InputMaybe<Scalars['String']>;
  _neq?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']>;
  _nin?: InputMaybe<Array<Scalars['String']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']>;
};

/** mutation root */
export type MutationRoot = {
  __typename?: 'mutation_root';
  /** delete single row from the table: "todos" */
  deleteTodo?: Maybe<Todos>;
  /** delete data from the table: "todos" */
  deleteTodos?: Maybe<TodosMutationResponse>;
  /** insert a single row into the table: "todos" */
  insertTodo?: Maybe<Todos>;
  /** insert data into the table: "todos" */
  insertTodos?: Maybe<TodosMutationResponse>;
  /** update single row of the table: "todos" */
  updateTodo?: Maybe<Todos>;
  /** update data of the table: "todos" */
  updateTodos?: Maybe<TodosMutationResponse>;
};


/** mutation root */
export type MutationRootDeleteTodoArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type MutationRootDeleteTodosArgs = {
  where: TodosBoolExp;
};


/** mutation root */
export type MutationRootInsertTodoArgs = {
  object: TodosInsertInput;
  on_conflict?: InputMaybe<TodosOnConflict>;
};


/** mutation root */
export type MutationRootInsertTodosArgs = {
  objects: Array<TodosInsertInput>;
  on_conflict?: InputMaybe<TodosOnConflict>;
};


/** mutation root */
export type MutationRootUpdateTodoArgs = {
  _set?: InputMaybe<TodosSetInput>;
  pk_columns: TodosPkColumnsInput;
};


/** mutation root */
export type MutationRootUpdateTodosArgs = {
  _set?: InputMaybe<TodosSetInput>;
  where: TodosBoolExp;
};

/** column ordering options */
export enum OrderBy {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

export type QueryRoot = {
  __typename?: 'query_root';
  /** fetch data from the table: "todos" using primary key columns */
  todo?: Maybe<Todos>;
  /** fetch data from the table: "todos" */
  todos: Array<Todos>;
  /** fetch aggregated fields from the table: "todos" */
  todosAggregate: TodosAggregate;
};


export type QueryRootTodoArgs = {
  id: Scalars['uuid'];
};


export type QueryRootTodosArgs = {
  distinct_on?: InputMaybe<Array<TodosSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<TodosOrderBy>>;
  where?: InputMaybe<TodosBoolExp>;
};


export type QueryRootTodosAggregateArgs = {
  distinct_on?: InputMaybe<Array<TodosSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<TodosOrderBy>>;
  where?: InputMaybe<TodosBoolExp>;
};

export type SubscriptionRoot = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "todos" using primary key columns */
  todo?: Maybe<Todos>;
  /** fetch data from the table: "todos" */
  todos: Array<Todos>;
  /** fetch aggregated fields from the table: "todos" */
  todosAggregate: TodosAggregate;
};


export type SubscriptionRootTodoArgs = {
  id: Scalars['uuid'];
};


export type SubscriptionRootTodosArgs = {
  distinct_on?: InputMaybe<Array<TodosSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<TodosOrderBy>>;
  where?: InputMaybe<TodosBoolExp>;
};


export type SubscriptionRootTodosAggregateArgs = {
  distinct_on?: InputMaybe<Array<TodosSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<TodosOrderBy>>;
  where?: InputMaybe<TodosBoolExp>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type TimestamptzComparisonExp = {
  _eq?: InputMaybe<Scalars['timestamptz']>;
  _gt?: InputMaybe<Scalars['timestamptz']>;
  _gte?: InputMaybe<Scalars['timestamptz']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['timestamptz']>;
  _lte?: InputMaybe<Scalars['timestamptz']>;
  _neq?: InputMaybe<Scalars['timestamptz']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']>>;
};

/** columns and relationships of "todos" */
export type Todos = {
  __typename?: 'todos';
  contents: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
  userId: Scalars['uuid'];
};

/** aggregated selection of "todos" */
export type TodosAggregate = {
  __typename?: 'todos_aggregate';
  aggregate?: Maybe<TodosAggregateFields>;
  nodes: Array<Todos>;
};

/** aggregate fields of "todos" */
export type TodosAggregateFields = {
  __typename?: 'todos_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<TodosMaxFields>;
  min?: Maybe<TodosMinFields>;
};


/** aggregate fields of "todos" */
export type TodosAggregateFieldsCountArgs = {
  columns?: InputMaybe<Array<TodosSelectColumn>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "todos". All fields are combined with a logical 'AND'. */
export type TodosBoolExp = {
  _and?: InputMaybe<Array<TodosBoolExp>>;
  _not?: InputMaybe<TodosBoolExp>;
  _or?: InputMaybe<Array<TodosBoolExp>>;
  contents?: InputMaybe<StringComparisonExp>;
  createdAt?: InputMaybe<TimestamptzComparisonExp>;
  id?: InputMaybe<UuidComparisonExp>;
  updatedAt?: InputMaybe<TimestamptzComparisonExp>;
  userId?: InputMaybe<UuidComparisonExp>;
};

/** unique or primary key constraints on table "todos" */
export enum TodosConstraint {
  /** unique or primary key constraint */
  TodosPkey = 'todos_pkey'
}

/** input type for inserting data into table "todos" */
export type TodosInsertInput = {
  contents?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type TodosMaxFields = {
  __typename?: 'todos_max_fields';
  contents?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** aggregate min on columns */
export type TodosMinFields = {
  __typename?: 'todos_min_fields';
  contents?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** response of any mutation on the table "todos" */
export type TodosMutationResponse = {
  __typename?: 'todos_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Todos>;
};

/** on_conflict condition type for table "todos" */
export type TodosOnConflict = {
  constraint: TodosConstraint;
  update_columns?: Array<TodosUpdateColumn>;
  where?: InputMaybe<TodosBoolExp>;
};

/** Ordering options when selecting data from "todos". */
export type TodosOrderBy = {
  contents?: InputMaybe<OrderBy>;
  createdAt?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  updatedAt?: InputMaybe<OrderBy>;
  userId?: InputMaybe<OrderBy>;
};

/** primary key columns input for table: todos */
export type TodosPkColumnsInput = {
  id: Scalars['uuid'];
};

/** select columns of table "todos" */
export enum TodosSelectColumn {
  /** column name */
  Contents = 'contents',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "todos" */
export type TodosSetInput = {
  contents?: InputMaybe<Scalars['String']>;
};

/** update columns of table "todos" */
export enum TodosUpdateColumn {
  /** column name */
  Contents = 'contents'
}

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type UuidComparisonExp = {
  _eq?: InputMaybe<Scalars['uuid']>;
  _gt?: InputMaybe<Scalars['uuid']>;
  _gte?: InputMaybe<Scalars['uuid']>;
  _in?: InputMaybe<Array<Scalars['uuid']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['uuid']>;
  _lte?: InputMaybe<Scalars['uuid']>;
  _neq?: InputMaybe<Scalars['uuid']>;
  _nin?: InputMaybe<Array<Scalars['uuid']>>;
};

export type TodoListQueryVariables = Exact<{ [key: string]: never; }>;


export type TodoListQuery = { __typename?: 'query_root', todos: Array<{ __typename?: 'todos', id: any, contents: string }> };

export type AddItemMutationVariables = Exact<{
  contents: Scalars['String'];
}>;


export type AddItemMutation = { __typename?: 'mutation_root', insertTodo?: { __typename?: 'todos', id: any } | null };
