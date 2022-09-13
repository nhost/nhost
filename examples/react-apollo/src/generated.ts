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
  bigint: number;
  citext: string;
  jsonb: any;
  timestamptz: string;
  uuid: string;
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type BooleanComparisonExp = {
  _eq?: InputMaybe<Scalars['Boolean']>;
  _gt?: InputMaybe<Scalars['Boolean']>;
  _gte?: InputMaybe<Scalars['Boolean']>;
  _in?: InputMaybe<Array<Scalars['Boolean']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['Boolean']>;
  _lte?: InputMaybe<Scalars['Boolean']>;
  _neq?: InputMaybe<Scalars['Boolean']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type IntComparisonExp = {
  _eq?: InputMaybe<Scalars['Int']>;
  _gt?: InputMaybe<Scalars['Int']>;
  _gte?: InputMaybe<Scalars['Int']>;
  _in?: InputMaybe<Array<Scalars['Int']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['Int']>;
  _lte?: InputMaybe<Scalars['Int']>;
  _neq?: InputMaybe<Scalars['Int']>;
  _nin?: InputMaybe<Array<Scalars['Int']>>;
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

/** User webauthn authenticators. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthUserAuthenticators = {
  __typename?: 'authUserAuthenticators';
  counter: Scalars['bigint'];
  id: Scalars['uuid'];
  nickname?: Maybe<Scalars['String']>;
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "auth.user_authenticators" */
export type AuthUserAuthenticatorsAggregate = {
  __typename?: 'authUserAuthenticators_aggregate';
  aggregate?: Maybe<AuthUserAuthenticatorsAggregateFields>;
  nodes: Array<AuthUserAuthenticators>;
};

/** aggregate fields of "auth.user_authenticators" */
export type AuthUserAuthenticatorsAggregateFields = {
  __typename?: 'authUserAuthenticators_aggregate_fields';
  avg?: Maybe<AuthUserAuthenticatorsAvgFields>;
  count: Scalars['Int'];
  max?: Maybe<AuthUserAuthenticatorsMaxFields>;
  min?: Maybe<AuthUserAuthenticatorsMinFields>;
  stddev?: Maybe<AuthUserAuthenticatorsStddevFields>;
  stddev_pop?: Maybe<AuthUserAuthenticatorsStddevPopFields>;
  stddev_samp?: Maybe<AuthUserAuthenticatorsStddevSampFields>;
  sum?: Maybe<AuthUserAuthenticatorsSumFields>;
  var_pop?: Maybe<AuthUserAuthenticatorsVarPopFields>;
  var_samp?: Maybe<AuthUserAuthenticatorsVarSampFields>;
  variance?: Maybe<AuthUserAuthenticatorsVarianceFields>;
};


/** aggregate fields of "auth.user_authenticators" */
export type AuthUserAuthenticatorsAggregateFieldsCountArgs = {
  columns?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsAggregateOrderBy = {
  avg?: InputMaybe<AuthUserAuthenticatorsAvgOrderBy>;
  count?: InputMaybe<OrderBy>;
  max?: InputMaybe<AuthUserAuthenticatorsMaxOrderBy>;
  min?: InputMaybe<AuthUserAuthenticatorsMinOrderBy>;
  stddev?: InputMaybe<AuthUserAuthenticatorsStddevOrderBy>;
  stddev_pop?: InputMaybe<AuthUserAuthenticatorsStddevPopOrderBy>;
  stddev_samp?: InputMaybe<AuthUserAuthenticatorsStddevSampOrderBy>;
  sum?: InputMaybe<AuthUserAuthenticatorsSumOrderBy>;
  var_pop?: InputMaybe<AuthUserAuthenticatorsVarPopOrderBy>;
  var_samp?: InputMaybe<AuthUserAuthenticatorsVarSampOrderBy>;
  variance?: InputMaybe<AuthUserAuthenticatorsVarianceOrderBy>;
};

/** aggregate avg on columns */
export type AuthUserAuthenticatorsAvgFields = {
  __typename?: 'authUserAuthenticators_avg_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsAvgOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** Boolean expression to filter rows from the table "auth.user_authenticators". All fields are combined with a logical 'AND'. */
export type AuthUserAuthenticatorsBoolExp = {
  _and?: InputMaybe<Array<AuthUserAuthenticatorsBoolExp>>;
  _not?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
  _or?: InputMaybe<Array<AuthUserAuthenticatorsBoolExp>>;
  counter?: InputMaybe<BigintComparisonExp>;
  id?: InputMaybe<UuidComparisonExp>;
  nickname?: InputMaybe<StringComparisonExp>;
  user?: InputMaybe<UsersBoolExp>;
  userId?: InputMaybe<UuidComparisonExp>;
};

/** aggregate max on columns */
export type AuthUserAuthenticatorsMaxFields = {
  __typename?: 'authUserAuthenticators_max_fields';
  counter?: Maybe<Scalars['bigint']>;
  id?: Maybe<Scalars['uuid']>;
  nickname?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsMaxOrderBy = {
  counter?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  nickname?: InputMaybe<OrderBy>;
  userId?: InputMaybe<OrderBy>;
};

/** aggregate min on columns */
export type AuthUserAuthenticatorsMinFields = {
  __typename?: 'authUserAuthenticators_min_fields';
  counter?: Maybe<Scalars['bigint']>;
  id?: Maybe<Scalars['uuid']>;
  nickname?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsMinOrderBy = {
  counter?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  nickname?: InputMaybe<OrderBy>;
  userId?: InputMaybe<OrderBy>;
};

/** response of any mutation on the table "auth.user_authenticators" */
export type AuthUserAuthenticatorsMutationResponse = {
  __typename?: 'authUserAuthenticators_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserAuthenticators>;
};

/** Ordering options when selecting data from "auth.user_authenticators". */
export type AuthUserAuthenticatorsOrderBy = {
  counter?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  nickname?: InputMaybe<OrderBy>;
  user?: InputMaybe<UsersOrderBy>;
  userId?: InputMaybe<OrderBy>;
};

/** select columns of table "auth.user_authenticators" */
export enum AuthUserAuthenticatorsSelectColumn {
  /** column name */
  Counter = 'counter',
  /** column name */
  Id = 'id',
  /** column name */
  Nickname = 'nickname',
  /** column name */
  UserId = 'userId'
}

/** aggregate stddev on columns */
export type AuthUserAuthenticatorsStddevFields = {
  __typename?: 'authUserAuthenticators_stddev_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsStddevOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate stddev_pop on columns */
export type AuthUserAuthenticatorsStddevPopFields = {
  __typename?: 'authUserAuthenticators_stddev_pop_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsStddevPopOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate stddev_samp on columns */
export type AuthUserAuthenticatorsStddevSampFields = {
  __typename?: 'authUserAuthenticators_stddev_samp_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsStddevSampOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate sum on columns */
export type AuthUserAuthenticatorsSumFields = {
  __typename?: 'authUserAuthenticators_sum_fields';
  counter?: Maybe<Scalars['bigint']>;
};

/** order by sum() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsSumOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate var_pop on columns */
export type AuthUserAuthenticatorsVarPopFields = {
  __typename?: 'authUserAuthenticators_var_pop_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsVarPopOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate var_samp on columns */
export type AuthUserAuthenticatorsVarSampFields = {
  __typename?: 'authUserAuthenticators_var_samp_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsVarSampOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** aggregate variance on columns */
export type AuthUserAuthenticatorsVarianceFields = {
  __typename?: 'authUserAuthenticators_variance_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "auth.user_authenticators" */
export type AuthUserAuthenticatorsVarianceOrderBy = {
  counter?: InputMaybe<OrderBy>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type BigintComparisonExp = {
  _eq?: InputMaybe<Scalars['bigint']>;
  _gt?: InputMaybe<Scalars['bigint']>;
  _gte?: InputMaybe<Scalars['bigint']>;
  _in?: InputMaybe<Array<Scalars['bigint']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['bigint']>;
  _lte?: InputMaybe<Scalars['bigint']>;
  _neq?: InputMaybe<Scalars['bigint']>;
  _nin?: InputMaybe<Array<Scalars['bigint']>>;
};

/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
export type CitextComparisonExp = {
  _eq?: InputMaybe<Scalars['citext']>;
  _gt?: InputMaybe<Scalars['citext']>;
  _gte?: InputMaybe<Scalars['citext']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['citext']>;
  _in?: InputMaybe<Array<Scalars['citext']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['citext']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['citext']>;
  _lt?: InputMaybe<Scalars['citext']>;
  _lte?: InputMaybe<Scalars['citext']>;
  _neq?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['citext']>;
  _nin?: InputMaybe<Array<Scalars['citext']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['citext']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['citext']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['citext']>;
};

/** columns and relationships of "storage.files" */
export type Files = {
  __typename?: 'files';
  bucketId: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  etag?: Maybe<Scalars['String']>;
  id: Scalars['uuid'];
  isUploaded?: Maybe<Scalars['Boolean']>;
  mimeType?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  size?: Maybe<Scalars['Int']>;
  updatedAt: Scalars['timestamptz'];
  uploadedByUserId?: Maybe<Scalars['uuid']>;
};

/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
export type FilesBoolExp = {
  _and?: InputMaybe<Array<FilesBoolExp>>;
  _not?: InputMaybe<FilesBoolExp>;
  _or?: InputMaybe<Array<FilesBoolExp>>;
  bucketId?: InputMaybe<StringComparisonExp>;
  createdAt?: InputMaybe<TimestamptzComparisonExp>;
  etag?: InputMaybe<StringComparisonExp>;
  id?: InputMaybe<UuidComparisonExp>;
  isUploaded?: InputMaybe<BooleanComparisonExp>;
  mimeType?: InputMaybe<StringComparisonExp>;
  name?: InputMaybe<StringComparisonExp>;
  size?: InputMaybe<IntComparisonExp>;
  updatedAt?: InputMaybe<TimestamptzComparisonExp>;
  uploadedByUserId?: InputMaybe<UuidComparisonExp>;
};

/** unique or primary key constraints on table "storage.files" */
export enum FilesConstraint {
  /** unique or primary key constraint on columns "id" */
  FilesPkey = 'files_pkey'
}

/** input type for incrementing numeric columns in table "storage.files" */
export type FilesIncInput = {
  size?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "storage.files" */
export type FilesInsertInput = {
  bucketId?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  etag?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isUploaded?: InputMaybe<Scalars['Boolean']>;
  mimeType?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  size?: InputMaybe<Scalars['Int']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  uploadedByUserId?: InputMaybe<Scalars['uuid']>;
};

/** response of any mutation on the table "storage.files" */
export type FilesMutationResponse = {
  __typename?: 'files_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Files>;
};

/** on_conflict condition type for table "storage.files" */
export type FilesOnConflict = {
  constraint: FilesConstraint;
  update_columns?: Array<FilesUpdateColumn>;
  where?: InputMaybe<FilesBoolExp>;
};

/** Ordering options when selecting data from "storage.files". */
export type FilesOrderBy = {
  bucketId?: InputMaybe<OrderBy>;
  createdAt?: InputMaybe<OrderBy>;
  etag?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  isUploaded?: InputMaybe<OrderBy>;
  mimeType?: InputMaybe<OrderBy>;
  name?: InputMaybe<OrderBy>;
  size?: InputMaybe<OrderBy>;
  updatedAt?: InputMaybe<OrderBy>;
  uploadedByUserId?: InputMaybe<OrderBy>;
};

/** primary key columns input for table: files */
export type FilesPkColumnsInput = {
  id: Scalars['uuid'];
};

/** select columns of table "storage.files" */
export enum FilesSelectColumn {
  /** column name */
  BucketId = 'bucketId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Etag = 'etag',
  /** column name */
  Id = 'id',
  /** column name */
  IsUploaded = 'isUploaded',
  /** column name */
  MimeType = 'mimeType',
  /** column name */
  Name = 'name',
  /** column name */
  Size = 'size',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UploadedByUserId = 'uploadedByUserId'
}

/** input type for updating data in table "storage.files" */
export type FilesSetInput = {
  bucketId?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  etag?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isUploaded?: InputMaybe<Scalars['Boolean']>;
  mimeType?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  size?: InputMaybe<Scalars['Int']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  uploadedByUserId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "storage.files" */
export enum FilesUpdateColumn {
  /** column name */
  BucketId = 'bucketId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Etag = 'etag',
  /** column name */
  Id = 'id',
  /** column name */
  IsUploaded = 'isUploaded',
  /** column name */
  MimeType = 'mimeType',
  /** column name */
  Name = 'name',
  /** column name */
  Size = 'size',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UploadedByUserId = 'uploadedByUserId'
}

export type FilesUpdates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<FilesIncInput>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<FilesSetInput>;
  where: FilesBoolExp;
};

export type JsonbCastExp = {
  String?: InputMaybe<StringComparisonExp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type JsonbComparisonExp = {
  _cast?: InputMaybe<JsonbCastExp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars['jsonb']>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars['jsonb']>;
  _eq?: InputMaybe<Scalars['jsonb']>;
  _gt?: InputMaybe<Scalars['jsonb']>;
  _gte?: InputMaybe<Scalars['jsonb']>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars['String']>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars['String']>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars['String']>>;
  _in?: InputMaybe<Array<Scalars['jsonb']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['jsonb']>;
  _lte?: InputMaybe<Scalars['jsonb']>;
  _neq?: InputMaybe<Scalars['jsonb']>;
  _nin?: InputMaybe<Array<Scalars['jsonb']>>;
};

/** mutation root */
export type MutationRoot = {
  __typename?: 'mutation_root';
  /** delete single row from the table: "auth.user_authenticators" */
  deleteAuthUserAuthenticator?: Maybe<AuthUserAuthenticators>;
  /** delete data from the table: "auth.user_authenticators" */
  deleteAuthUserAuthenticators?: Maybe<AuthUserAuthenticatorsMutationResponse>;
  /** delete single row from the table: "storage.files" */
  deleteFile?: Maybe<Files>;
  /** delete data from the table: "storage.files" */
  deleteFiles?: Maybe<FilesMutationResponse>;
  /** delete single row from the table: "todos" */
  deleteTodo?: Maybe<Todos>;
  /** delete data from the table: "todos" */
  deleteTodos?: Maybe<TodosMutationResponse>;
  /** insert a single row into the table: "storage.files" */
  insertFile?: Maybe<Files>;
  /** insert data into the table: "storage.files" */
  insertFiles?: Maybe<FilesMutationResponse>;
  /** insert a single row into the table: "todos" */
  insertTodo?: Maybe<Todos>;
  /** insert data into the table: "todos" */
  insertTodos?: Maybe<TodosMutationResponse>;
  /** update single row of the table: "storage.files" */
  updateFile?: Maybe<Files>;
  /** update data of the table: "storage.files" */
  updateFiles?: Maybe<FilesMutationResponse>;
  /** update single row of the table: "todos" */
  updateTodo?: Maybe<Todos>;
  /** update data of the table: "todos" */
  updateTodos?: Maybe<TodosMutationResponse>;
  /** update multiples rows of table: "storage.files" */
  update_files_many?: Maybe<Array<Maybe<FilesMutationResponse>>>;
  /** update multiples rows of table: "todos" */
  update_todos_many?: Maybe<Array<Maybe<TodosMutationResponse>>>;
};


/** mutation root */
export type MutationRootDeleteAuthUserAuthenticatorArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type MutationRootDeleteAuthUserAuthenticatorsArgs = {
  where: AuthUserAuthenticatorsBoolExp;
};


/** mutation root */
export type MutationRootDeleteFileArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type MutationRootDeleteFilesArgs = {
  where: FilesBoolExp;
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
export type MutationRootInsertFileArgs = {
  object: FilesInsertInput;
  on_conflict?: InputMaybe<FilesOnConflict>;
};


/** mutation root */
export type MutationRootInsertFilesArgs = {
  objects: Array<FilesInsertInput>;
  on_conflict?: InputMaybe<FilesOnConflict>;
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
export type MutationRootUpdateFileArgs = {
  _inc?: InputMaybe<FilesIncInput>;
  _set?: InputMaybe<FilesSetInput>;
  pk_columns: FilesPkColumnsInput;
};


/** mutation root */
export type MutationRootUpdateFilesArgs = {
  _inc?: InputMaybe<FilesIncInput>;
  _set?: InputMaybe<FilesSetInput>;
  where: FilesBoolExp;
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


/** mutation root */
export type MutationRootUpdateFilesManyArgs = {
  updates: Array<FilesUpdates>;
};


/** mutation root */
export type MutationRootUpdateTodosManyArgs = {
  updates: Array<TodosUpdates>;
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
  /** fetch data from the table: "auth.user_authenticators" using primary key columns */
  authUserAuthenticator?: Maybe<AuthUserAuthenticators>;
  /** fetch data from the table: "auth.user_authenticators" */
  authUserAuthenticators: Array<AuthUserAuthenticators>;
  /** fetch aggregated fields from the table: "auth.user_authenticators" */
  authUserAuthenticatorsAggregate: AuthUserAuthenticatorsAggregate;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table: "todos" using primary key columns */
  todo?: Maybe<Todos>;
  /** fetch data from the table: "todos" */
  todos: Array<Todos>;
  /** fetch aggregated fields from the table: "todos" */
  todosAggregate: TodosAggregate;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
};


export type QueryRootAuthUserAuthenticatorArgs = {
  id: Scalars['uuid'];
};


export type QueryRootAuthUserAuthenticatorsArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


export type QueryRootAuthUserAuthenticatorsAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


export type QueryRootFileArgs = {
  id: Scalars['uuid'];
};


export type QueryRootFilesArgs = {
  distinct_on?: InputMaybe<Array<FilesSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FilesOrderBy>>;
  where?: InputMaybe<FilesBoolExp>;
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


export type QueryRootUserArgs = {
  id: Scalars['uuid'];
};


export type QueryRootUsersArgs = {
  distinct_on?: InputMaybe<Array<UsersSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<UsersOrderBy>>;
  where?: InputMaybe<UsersBoolExp>;
};

export type SubscriptionRoot = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "auth.user_authenticators" using primary key columns */
  authUserAuthenticator?: Maybe<AuthUserAuthenticators>;
  /** fetch data from the table: "auth.user_authenticators" */
  authUserAuthenticators: Array<AuthUserAuthenticators>;
  /** fetch aggregated fields from the table: "auth.user_authenticators" */
  authUserAuthenticatorsAggregate: AuthUserAuthenticatorsAggregate;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table: "todos" using primary key columns */
  todo?: Maybe<Todos>;
  /** fetch data from the table: "todos" */
  todos: Array<Todos>;
  /** fetch aggregated fields from the table: "todos" */
  todosAggregate: TodosAggregate;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
};


export type SubscriptionRootAuthUserAuthenticatorArgs = {
  id: Scalars['uuid'];
};


export type SubscriptionRootAuthUserAuthenticatorsArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


export type SubscriptionRootAuthUserAuthenticatorsAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


export type SubscriptionRootFileArgs = {
  id: Scalars['uuid'];
};


export type SubscriptionRootFilesArgs = {
  distinct_on?: InputMaybe<Array<FilesSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FilesOrderBy>>;
  where?: InputMaybe<FilesBoolExp>;
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


export type SubscriptionRootUserArgs = {
  id: Scalars['uuid'];
};


export type SubscriptionRootUsersArgs = {
  distinct_on?: InputMaybe<Array<UsersSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<UsersOrderBy>>;
  where?: InputMaybe<UsersBoolExp>;
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
  /** An object relationship */
  user: Users;
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
  user?: InputMaybe<UsersBoolExp>;
  userId?: InputMaybe<UuidComparisonExp>;
};

/** unique or primary key constraints on table "todos" */
export enum TodosConstraint {
  /** unique or primary key constraint on columns "id" */
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
  user?: InputMaybe<UsersOrderBy>;
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

export type TodosUpdates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<TodosSetInput>;
  where: TodosBoolExp;
};

/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type Users = {
  __typename?: 'users';
  activeMfaType?: Maybe<Scalars['String']>;
  /** An array relationship */
  authenticators: Array<AuthUserAuthenticators>;
  /** An aggregate relationship */
  authenticators_aggregate: AuthUserAuthenticatorsAggregate;
  avatarUrl: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  currentChallenge?: Maybe<Scalars['String']>;
  defaultRole: Scalars['String'];
  disabled: Scalars['Boolean'];
  displayName: Scalars['String'];
  email?: Maybe<Scalars['citext']>;
  emailVerified: Scalars['Boolean'];
  id: Scalars['uuid'];
  isAnonymous: Scalars['Boolean'];
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale: Scalars['String'];
  metadata?: Maybe<Scalars['jsonb']>;
  otpHash?: Maybe<Scalars['String']>;
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  phoneNumberVerified: Scalars['Boolean'];
  updatedAt: Scalars['timestamptz'];
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersAuthenticatorsArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersAuthenticatorsAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserAuthenticatorsSelectColumn>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserAuthenticatorsOrderBy>>;
  where?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersMetadataArgs = {
  path?: InputMaybe<Scalars['String']>;
};

/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
export type UsersBoolExp = {
  _and?: InputMaybe<Array<UsersBoolExp>>;
  _not?: InputMaybe<UsersBoolExp>;
  _or?: InputMaybe<Array<UsersBoolExp>>;
  activeMfaType?: InputMaybe<StringComparisonExp>;
  authenticators?: InputMaybe<AuthUserAuthenticatorsBoolExp>;
  avatarUrl?: InputMaybe<StringComparisonExp>;
  createdAt?: InputMaybe<TimestamptzComparisonExp>;
  currentChallenge?: InputMaybe<StringComparisonExp>;
  defaultRole?: InputMaybe<StringComparisonExp>;
  disabled?: InputMaybe<BooleanComparisonExp>;
  displayName?: InputMaybe<StringComparisonExp>;
  email?: InputMaybe<CitextComparisonExp>;
  emailVerified?: InputMaybe<BooleanComparisonExp>;
  id?: InputMaybe<UuidComparisonExp>;
  isAnonymous?: InputMaybe<BooleanComparisonExp>;
  lastSeen?: InputMaybe<TimestamptzComparisonExp>;
  locale?: InputMaybe<StringComparisonExp>;
  metadata?: InputMaybe<JsonbComparisonExp>;
  otpHash?: InputMaybe<StringComparisonExp>;
  otpMethodLastUsed?: InputMaybe<StringComparisonExp>;
  phoneNumber?: InputMaybe<StringComparisonExp>;
  phoneNumberVerified?: InputMaybe<BooleanComparisonExp>;
  updatedAt?: InputMaybe<TimestamptzComparisonExp>;
};

/** Ordering options when selecting data from "auth.users". */
export type UsersOrderBy = {
  activeMfaType?: InputMaybe<OrderBy>;
  authenticators_aggregate?: InputMaybe<AuthUserAuthenticatorsAggregateOrderBy>;
  avatarUrl?: InputMaybe<OrderBy>;
  createdAt?: InputMaybe<OrderBy>;
  currentChallenge?: InputMaybe<OrderBy>;
  defaultRole?: InputMaybe<OrderBy>;
  disabled?: InputMaybe<OrderBy>;
  displayName?: InputMaybe<OrderBy>;
  email?: InputMaybe<OrderBy>;
  emailVerified?: InputMaybe<OrderBy>;
  id?: InputMaybe<OrderBy>;
  isAnonymous?: InputMaybe<OrderBy>;
  lastSeen?: InputMaybe<OrderBy>;
  locale?: InputMaybe<OrderBy>;
  metadata?: InputMaybe<OrderBy>;
  otpHash?: InputMaybe<OrderBy>;
  otpMethodLastUsed?: InputMaybe<OrderBy>;
  phoneNumber?: InputMaybe<OrderBy>;
  phoneNumberVerified?: InputMaybe<OrderBy>;
  updatedAt?: InputMaybe<OrderBy>;
};

/** select columns of table "auth.users" */
export enum UsersSelectColumn {
  /** column name */
  ActiveMfaType = 'activeMfaType',
  /** column name */
  AvatarUrl = 'avatarUrl',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CurrentChallenge = 'currentChallenge',
  /** column name */
  DefaultRole = 'defaultRole',
  /** column name */
  Disabled = 'disabled',
  /** column name */
  DisplayName = 'displayName',
  /** column name */
  Email = 'email',
  /** column name */
  EmailVerified = 'emailVerified',
  /** column name */
  Id = 'id',
  /** column name */
  IsAnonymous = 'isAnonymous',
  /** column name */
  LastSeen = 'lastSeen',
  /** column name */
  Locale = 'locale',
  /** column name */
  Metadata = 'metadata',
  /** column name */
  OtpHash = 'otpHash',
  /** column name */
  OtpMethodLastUsed = 'otpMethodLastUsed',
  /** column name */
  PhoneNumber = 'phoneNumber',
  /** column name */
  PhoneNumberVerified = 'phoneNumberVerified',
  /** column name */
  UpdatedAt = 'updatedAt'
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


export type TodoListQuery = { __typename?: 'query_root', todos: Array<{ __typename?: 'todos', id: string, contents: string }> };

export type AddItemMutationVariables = Exact<{
  contents: Scalars['String'];
}>;


export type AddItemMutation = { __typename?: 'mutation_root', insertTodo?: { __typename?: 'todos', id: string, contents: string } | null };

export type NewTodoFragment = { __typename?: 'todos', id: string, contents: string };

export type SecurityKeysQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type SecurityKeysQuery = { __typename?: 'query_root', authUserAuthenticators: Array<{ __typename?: 'authUserAuthenticators', id: string, nickname?: string | null }> };

export type RemoveSecurityKeyMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type RemoveSecurityKeyMutation = { __typename?: 'mutation_root', deleteAuthUserAuthenticator?: { __typename?: 'authUserAuthenticators', id: string } | null };
