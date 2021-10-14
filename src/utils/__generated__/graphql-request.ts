import { GraphQLClient } from 'graphql-request';
import * as Dom from 'graphql-request/dist/types.dom';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
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
  citext: any;
  timestamptz: any;
  uuid: any;
};


/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: Maybe<Scalars['Boolean']>;
  _gt?: Maybe<Scalars['Boolean']>;
  _gte?: Maybe<Scalars['Boolean']>;
  _in?: Maybe<Array<Scalars['Boolean']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _lt?: Maybe<Scalars['Boolean']>;
  _lte?: Maybe<Scalars['Boolean']>;
  _neq?: Maybe<Scalars['Boolean']>;
  _nin?: Maybe<Array<Scalars['Boolean']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: Maybe<Scalars['String']>;
  _gt?: Maybe<Scalars['String']>;
  _gte?: Maybe<Scalars['String']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: Maybe<Scalars['String']>;
  _in?: Maybe<Array<Scalars['String']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: Maybe<Scalars['String']>;
  _is_null?: Maybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: Maybe<Scalars['String']>;
  _lt?: Maybe<Scalars['String']>;
  _lte?: Maybe<Scalars['String']>;
  _neq?: Maybe<Scalars['String']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: Maybe<Scalars['String']>;
  _nin?: Maybe<Array<Scalars['String']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: Maybe<Scalars['String']>;
  /** does the column NOT match the given pattern */
  _nlike?: Maybe<Scalars['String']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: Maybe<Scalars['String']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: Maybe<Scalars['String']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: Maybe<Scalars['String']>;
  /** does the column match the given SQL regular expression */
  _similar?: Maybe<Scalars['String']>;
};

/** columns and relationships of "auth.provider_requests" */
export type AuthProviderRequests = {
  __typename?: 'authProviderRequests';
  id: Scalars['uuid'];
  redirectUrl: Scalars['String'];
};

/** aggregated selection of "auth.provider_requests" */
export type AuthProviderRequests_Aggregate = {
  __typename?: 'authProviderRequests_aggregate';
  aggregate?: Maybe<AuthProviderRequests_Aggregate_Fields>;
  nodes: Array<AuthProviderRequests>;
};

/** aggregate fields of "auth.provider_requests" */
export type AuthProviderRequests_Aggregate_Fields = {
  __typename?: 'authProviderRequests_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthProviderRequests_Max_Fields>;
  min?: Maybe<AuthProviderRequests_Min_Fields>;
};


/** aggregate fields of "auth.provider_requests" */
export type AuthProviderRequests_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthProviderRequests_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
export type AuthProviderRequests_Bool_Exp = {
  _and?: Maybe<Array<AuthProviderRequests_Bool_Exp>>;
  _not?: Maybe<AuthProviderRequests_Bool_Exp>;
  _or?: Maybe<Array<AuthProviderRequests_Bool_Exp>>;
  id?: Maybe<Uuid_Comparison_Exp>;
  redirectUrl?: Maybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.provider_requests" */
export enum AuthProviderRequests_Constraint {
  /** unique or primary key constraint */
  ProviderRequestsPkey = 'provider_requests_pkey'
}

/** input type for inserting data into table "auth.provider_requests" */
export type AuthProviderRequests_Insert_Input = {
  id?: Maybe<Scalars['uuid']>;
  redirectUrl?: Maybe<Scalars['String']>;
};

/** aggregate max on columns */
export type AuthProviderRequests_Max_Fields = {
  __typename?: 'authProviderRequests_max_fields';
  id?: Maybe<Scalars['uuid']>;
  redirectUrl?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type AuthProviderRequests_Min_Fields = {
  __typename?: 'authProviderRequests_min_fields';
  id?: Maybe<Scalars['uuid']>;
  redirectUrl?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "auth.provider_requests" */
export type AuthProviderRequests_Mutation_Response = {
  __typename?: 'authProviderRequests_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthProviderRequests>;
};

/** on conflict condition type for table "auth.provider_requests" */
export type AuthProviderRequests_On_Conflict = {
  constraint: AuthProviderRequests_Constraint;
  update_columns?: Array<AuthProviderRequests_Update_Column>;
  where?: Maybe<AuthProviderRequests_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.provider_requests". */
export type AuthProviderRequests_Order_By = {
  id?: Maybe<Order_By>;
  redirectUrl?: Maybe<Order_By>;
};

/** primary key columns input for table: authProviderRequests */
export type AuthProviderRequests_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "auth.provider_requests" */
export enum AuthProviderRequests_Select_Column {
  /** column name */
  Id = 'id',
  /** column name */
  RedirectUrl = 'redirectUrl'
}

/** input type for updating data in table "auth.provider_requests" */
export type AuthProviderRequests_Set_Input = {
  id?: Maybe<Scalars['uuid']>;
  redirectUrl?: Maybe<Scalars['String']>;
};

/** update columns of table "auth.provider_requests" */
export enum AuthProviderRequests_Update_Column {
  /** column name */
  Id = 'id',
  /** column name */
  RedirectUrl = 'redirectUrl'
}

/** columns and relationships of "auth.providers" */
export type AuthProviders = {
  __typename?: 'authProviders';
  id: Scalars['String'];
  /** An array relationship */
  userProviders: Array<AuthUserProviders>;
  /** An aggregate relationship */
  userProviders_aggregate: AuthUserProviders_Aggregate;
};


/** columns and relationships of "auth.providers" */
export type AuthProvidersUserProvidersArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


/** columns and relationships of "auth.providers" */
export type AuthProvidersUserProviders_AggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};

/** aggregated selection of "auth.providers" */
export type AuthProviders_Aggregate = {
  __typename?: 'authProviders_aggregate';
  aggregate?: Maybe<AuthProviders_Aggregate_Fields>;
  nodes: Array<AuthProviders>;
};

/** aggregate fields of "auth.providers" */
export type AuthProviders_Aggregate_Fields = {
  __typename?: 'authProviders_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthProviders_Max_Fields>;
  min?: Maybe<AuthProviders_Min_Fields>;
};


/** aggregate fields of "auth.providers" */
export type AuthProviders_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthProviders_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
export type AuthProviders_Bool_Exp = {
  _and?: Maybe<Array<AuthProviders_Bool_Exp>>;
  _not?: Maybe<AuthProviders_Bool_Exp>;
  _or?: Maybe<Array<AuthProviders_Bool_Exp>>;
  id?: Maybe<String_Comparison_Exp>;
  userProviders?: Maybe<AuthUserProviders_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.providers" */
export enum AuthProviders_Constraint {
  /** unique or primary key constraint */
  ProvidersPkey = 'providers_pkey'
}

/** input type for inserting data into table "auth.providers" */
export type AuthProviders_Insert_Input = {
  id?: Maybe<Scalars['String']>;
  userProviders?: Maybe<AuthUserProviders_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type AuthProviders_Max_Fields = {
  __typename?: 'authProviders_max_fields';
  id?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type AuthProviders_Min_Fields = {
  __typename?: 'authProviders_min_fields';
  id?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "auth.providers" */
export type AuthProviders_Mutation_Response = {
  __typename?: 'authProviders_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthProviders>;
};

/** input type for inserting object relation for remote table "auth.providers" */
export type AuthProviders_Obj_Rel_Insert_Input = {
  data: AuthProviders_Insert_Input;
  /** on conflict condition */
  on_conflict?: Maybe<AuthProviders_On_Conflict>;
};

/** on conflict condition type for table "auth.providers" */
export type AuthProviders_On_Conflict = {
  constraint: AuthProviders_Constraint;
  update_columns?: Array<AuthProviders_Update_Column>;
  where?: Maybe<AuthProviders_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.providers". */
export type AuthProviders_Order_By = {
  id?: Maybe<Order_By>;
  userProviders_aggregate?: Maybe<AuthUserProviders_Aggregate_Order_By>;
};

/** primary key columns input for table: authProviders */
export type AuthProviders_Pk_Columns_Input = {
  id: Scalars['String'];
};

/** select columns of table "auth.providers" */
export enum AuthProviders_Select_Column {
  /** column name */
  Id = 'id'
}

/** input type for updating data in table "auth.providers" */
export type AuthProviders_Set_Input = {
  id?: Maybe<Scalars['String']>;
};

/** update columns of table "auth.providers" */
export enum AuthProviders_Update_Column {
  /** column name */
  Id = 'id'
}

/** columns and relationships of "auth.refresh_tokens" */
export type AuthRefreshTokens = {
  __typename?: 'authRefreshTokens';
  createdAt: Scalars['timestamptz'];
  expiresAt: Scalars['timestamptz'];
  refreshToken: Scalars['uuid'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate = {
  __typename?: 'authRefreshTokens_aggregate';
  aggregate?: Maybe<AuthRefreshTokens_Aggregate_Fields>;
  nodes: Array<AuthRefreshTokens>;
};

/** aggregate fields of "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate_Fields = {
  __typename?: 'authRefreshTokens_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthRefreshTokens_Max_Fields>;
  min?: Maybe<AuthRefreshTokens_Min_Fields>;
};


/** aggregate fields of "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate_Order_By = {
  count?: Maybe<Order_By>;
  max?: Maybe<AuthRefreshTokens_Max_Order_By>;
  min?: Maybe<AuthRefreshTokens_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.refresh_tokens" */
export type AuthRefreshTokens_Arr_Rel_Insert_Input = {
  data: Array<AuthRefreshTokens_Insert_Input>;
  /** on conflict condition */
  on_conflict?: Maybe<AuthRefreshTokens_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
export type AuthRefreshTokens_Bool_Exp = {
  _and?: Maybe<Array<AuthRefreshTokens_Bool_Exp>>;
  _not?: Maybe<AuthRefreshTokens_Bool_Exp>;
  _or?: Maybe<Array<AuthRefreshTokens_Bool_Exp>>;
  createdAt?: Maybe<Timestamptz_Comparison_Exp>;
  expiresAt?: Maybe<Timestamptz_Comparison_Exp>;
  refreshToken?: Maybe<Uuid_Comparison_Exp>;
  user?: Maybe<Users_Bool_Exp>;
  userId?: Maybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.refresh_tokens" */
export enum AuthRefreshTokens_Constraint {
  /** unique or primary key constraint */
  RefreshTokensPkey = 'refresh_tokens_pkey'
}

/** input type for inserting data into table "auth.refresh_tokens" */
export type AuthRefreshTokens_Insert_Input = {
  createdAt?: Maybe<Scalars['timestamptz']>;
  expiresAt?: Maybe<Scalars['timestamptz']>;
  refreshToken?: Maybe<Scalars['uuid']>;
  user?: Maybe<Users_Obj_Rel_Insert_Input>;
  userId?: Maybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type AuthRefreshTokens_Max_Fields = {
  __typename?: 'authRefreshTokens_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  expiresAt?: Maybe<Scalars['timestamptz']>;
  refreshToken?: Maybe<Scalars['uuid']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Max_Order_By = {
  createdAt?: Maybe<Order_By>;
  expiresAt?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** aggregate min on columns */
export type AuthRefreshTokens_Min_Fields = {
  __typename?: 'authRefreshTokens_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  expiresAt?: Maybe<Scalars['timestamptz']>;
  refreshToken?: Maybe<Scalars['uuid']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Min_Order_By = {
  createdAt?: Maybe<Order_By>;
  expiresAt?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** response of any mutation on the table "auth.refresh_tokens" */
export type AuthRefreshTokens_Mutation_Response = {
  __typename?: 'authRefreshTokens_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthRefreshTokens>;
};

/** on conflict condition type for table "auth.refresh_tokens" */
export type AuthRefreshTokens_On_Conflict = {
  constraint: AuthRefreshTokens_Constraint;
  update_columns?: Array<AuthRefreshTokens_Update_Column>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.refresh_tokens". */
export type AuthRefreshTokens_Order_By = {
  createdAt?: Maybe<Order_By>;
  expiresAt?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  user?: Maybe<Users_Order_By>;
  userId?: Maybe<Order_By>;
};

/** primary key columns input for table: authRefreshTokens */
export type AuthRefreshTokens_Pk_Columns_Input = {
  refreshToken: Scalars['uuid'];
};

/** select columns of table "auth.refresh_tokens" */
export enum AuthRefreshTokens_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExpiresAt = 'expiresAt',
  /** column name */
  RefreshToken = 'refreshToken',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "auth.refresh_tokens" */
export type AuthRefreshTokens_Set_Input = {
  createdAt?: Maybe<Scalars['timestamptz']>;
  expiresAt?: Maybe<Scalars['timestamptz']>;
  refreshToken?: Maybe<Scalars['uuid']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** update columns of table "auth.refresh_tokens" */
export enum AuthRefreshTokens_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExpiresAt = 'expiresAt',
  /** column name */
  RefreshToken = 'refreshToken',
  /** column name */
  UserId = 'userId'
}

/** columns and relationships of "auth.roles" */
export type AuthRoles = {
  __typename?: 'authRoles';
  role: Scalars['String'];
  /** An array relationship */
  userRoles: Array<AuthUserRoles>;
  /** An aggregate relationship */
  userRoles_aggregate: AuthUserRoles_Aggregate;
  /** An array relationship */
  usersByDefaultRole: Array<Users>;
  /** An aggregate relationship */
  usersByDefaultRole_aggregate: Users_Aggregate;
};


/** columns and relationships of "auth.roles" */
export type AuthRolesUserRolesArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


/** columns and relationships of "auth.roles" */
export type AuthRolesUserRoles_AggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


/** columns and relationships of "auth.roles" */
export type AuthRolesUsersByDefaultRoleArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};


/** columns and relationships of "auth.roles" */
export type AuthRolesUsersByDefaultRole_AggregateArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};

/** aggregated selection of "auth.roles" */
export type AuthRoles_Aggregate = {
  __typename?: 'authRoles_aggregate';
  aggregate?: Maybe<AuthRoles_Aggregate_Fields>;
  nodes: Array<AuthRoles>;
};

/** aggregate fields of "auth.roles" */
export type AuthRoles_Aggregate_Fields = {
  __typename?: 'authRoles_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthRoles_Max_Fields>;
  min?: Maybe<AuthRoles_Min_Fields>;
};


/** aggregate fields of "auth.roles" */
export type AuthRoles_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthRoles_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
export type AuthRoles_Bool_Exp = {
  _and?: Maybe<Array<AuthRoles_Bool_Exp>>;
  _not?: Maybe<AuthRoles_Bool_Exp>;
  _or?: Maybe<Array<AuthRoles_Bool_Exp>>;
  role?: Maybe<String_Comparison_Exp>;
  userRoles?: Maybe<AuthUserRoles_Bool_Exp>;
  usersByDefaultRole?: Maybe<Users_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.roles" */
export enum AuthRoles_Constraint {
  /** unique or primary key constraint */
  RolesPkey = 'roles_pkey'
}

/** input type for inserting data into table "auth.roles" */
export type AuthRoles_Insert_Input = {
  role?: Maybe<Scalars['String']>;
  userRoles?: Maybe<AuthUserRoles_Arr_Rel_Insert_Input>;
  usersByDefaultRole?: Maybe<Users_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type AuthRoles_Max_Fields = {
  __typename?: 'authRoles_max_fields';
  role?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type AuthRoles_Min_Fields = {
  __typename?: 'authRoles_min_fields';
  role?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "auth.roles" */
export type AuthRoles_Mutation_Response = {
  __typename?: 'authRoles_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthRoles>;
};

/** input type for inserting object relation for remote table "auth.roles" */
export type AuthRoles_Obj_Rel_Insert_Input = {
  data: AuthRoles_Insert_Input;
  /** on conflict condition */
  on_conflict?: Maybe<AuthRoles_On_Conflict>;
};

/** on conflict condition type for table "auth.roles" */
export type AuthRoles_On_Conflict = {
  constraint: AuthRoles_Constraint;
  update_columns?: Array<AuthRoles_Update_Column>;
  where?: Maybe<AuthRoles_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.roles". */
export type AuthRoles_Order_By = {
  role?: Maybe<Order_By>;
  userRoles_aggregate?: Maybe<AuthUserRoles_Aggregate_Order_By>;
  usersByDefaultRole_aggregate?: Maybe<Users_Aggregate_Order_By>;
};

/** primary key columns input for table: authRoles */
export type AuthRoles_Pk_Columns_Input = {
  role: Scalars['String'];
};

/** select columns of table "auth.roles" */
export enum AuthRoles_Select_Column {
  /** column name */
  Role = 'role'
}

/** input type for updating data in table "auth.roles" */
export type AuthRoles_Set_Input = {
  role?: Maybe<Scalars['String']>;
};

/** update columns of table "auth.roles" */
export enum AuthRoles_Update_Column {
  /** column name */
  Role = 'role'
}

/** columns and relationships of "auth.user_providers" */
export type AuthUserProviders = {
  __typename?: 'authUserProviders';
  accessToken: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  /** An object relationship */
  provider: AuthProviders;
  providerId: Scalars['String'];
  providerUserId: Scalars['String'];
  refreshToken?: Maybe<Scalars['String']>;
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "auth.user_providers" */
export type AuthUserProviders_Aggregate = {
  __typename?: 'authUserProviders_aggregate';
  aggregate?: Maybe<AuthUserProviders_Aggregate_Fields>;
  nodes: Array<AuthUserProviders>;
};

/** aggregate fields of "auth.user_providers" */
export type AuthUserProviders_Aggregate_Fields = {
  __typename?: 'authUserProviders_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthUserProviders_Max_Fields>;
  min?: Maybe<AuthUserProviders_Min_Fields>;
};


/** aggregate fields of "auth.user_providers" */
export type AuthUserProviders_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthUserProviders_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_providers" */
export type AuthUserProviders_Aggregate_Order_By = {
  count?: Maybe<Order_By>;
  max?: Maybe<AuthUserProviders_Max_Order_By>;
  min?: Maybe<AuthUserProviders_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.user_providers" */
export type AuthUserProviders_Arr_Rel_Insert_Input = {
  data: Array<AuthUserProviders_Insert_Input>;
  /** on conflict condition */
  on_conflict?: Maybe<AuthUserProviders_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
export type AuthUserProviders_Bool_Exp = {
  _and?: Maybe<Array<AuthUserProviders_Bool_Exp>>;
  _not?: Maybe<AuthUserProviders_Bool_Exp>;
  _or?: Maybe<Array<AuthUserProviders_Bool_Exp>>;
  accessToken?: Maybe<String_Comparison_Exp>;
  createdAt?: Maybe<Timestamptz_Comparison_Exp>;
  id?: Maybe<Uuid_Comparison_Exp>;
  provider?: Maybe<AuthProviders_Bool_Exp>;
  providerId?: Maybe<String_Comparison_Exp>;
  providerUserId?: Maybe<String_Comparison_Exp>;
  refreshToken?: Maybe<String_Comparison_Exp>;
  updatedAt?: Maybe<Timestamptz_Comparison_Exp>;
  user?: Maybe<Users_Bool_Exp>;
  userId?: Maybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.user_providers" */
export enum AuthUserProviders_Constraint {
  /** unique or primary key constraint */
  UserProvidersPkey = 'user_providers_pkey',
  /** unique or primary key constraint */
  UserProvidersProviderIdProviderUserIdKey = 'user_providers_provider_id_provider_user_id_key',
  /** unique or primary key constraint */
  UserProvidersUserIdProviderIdKey = 'user_providers_user_id_provider_id_key'
}

/** input type for inserting data into table "auth.user_providers" */
export type AuthUserProviders_Insert_Input = {
  accessToken?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  provider?: Maybe<AuthProviders_Obj_Rel_Insert_Input>;
  providerId?: Maybe<Scalars['String']>;
  providerUserId?: Maybe<Scalars['String']>;
  refreshToken?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  user?: Maybe<Users_Obj_Rel_Insert_Input>;
  userId?: Maybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type AuthUserProviders_Max_Fields = {
  __typename?: 'authUserProviders_max_fields';
  accessToken?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  providerId?: Maybe<Scalars['String']>;
  providerUserId?: Maybe<Scalars['String']>;
  refreshToken?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "auth.user_providers" */
export type AuthUserProviders_Max_Order_By = {
  accessToken?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  providerId?: Maybe<Order_By>;
  providerUserId?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** aggregate min on columns */
export type AuthUserProviders_Min_Fields = {
  __typename?: 'authUserProviders_min_fields';
  accessToken?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  providerId?: Maybe<Scalars['String']>;
  providerUserId?: Maybe<Scalars['String']>;
  refreshToken?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "auth.user_providers" */
export type AuthUserProviders_Min_Order_By = {
  accessToken?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  providerId?: Maybe<Order_By>;
  providerUserId?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** response of any mutation on the table "auth.user_providers" */
export type AuthUserProviders_Mutation_Response = {
  __typename?: 'authUserProviders_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserProviders>;
};

/** on conflict condition type for table "auth.user_providers" */
export type AuthUserProviders_On_Conflict = {
  constraint: AuthUserProviders_Constraint;
  update_columns?: Array<AuthUserProviders_Update_Column>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.user_providers". */
export type AuthUserProviders_Order_By = {
  accessToken?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  provider?: Maybe<AuthProviders_Order_By>;
  providerId?: Maybe<Order_By>;
  providerUserId?: Maybe<Order_By>;
  refreshToken?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
  user?: Maybe<Users_Order_By>;
  userId?: Maybe<Order_By>;
};

/** primary key columns input for table: authUserProviders */
export type AuthUserProviders_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "auth.user_providers" */
export enum AuthUserProviders_Select_Column {
  /** column name */
  AccessToken = 'accessToken',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  ProviderId = 'providerId',
  /** column name */
  ProviderUserId = 'providerUserId',
  /** column name */
  RefreshToken = 'refreshToken',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "auth.user_providers" */
export type AuthUserProviders_Set_Input = {
  accessToken?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  providerId?: Maybe<Scalars['String']>;
  providerUserId?: Maybe<Scalars['String']>;
  refreshToken?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** update columns of table "auth.user_providers" */
export enum AuthUserProviders_Update_Column {
  /** column name */
  AccessToken = 'accessToken',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  ProviderId = 'providerId',
  /** column name */
  ProviderUserId = 'providerUserId',
  /** column name */
  RefreshToken = 'refreshToken',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** columns and relationships of "auth.user_roles" */
export type AuthUserRoles = {
  __typename?: 'authUserRoles';
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  role: Scalars['String'];
  /** An object relationship */
  roleByRole: AuthRoles;
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "auth.user_roles" */
export type AuthUserRoles_Aggregate = {
  __typename?: 'authUserRoles_aggregate';
  aggregate?: Maybe<AuthUserRoles_Aggregate_Fields>;
  nodes: Array<AuthUserRoles>;
};

/** aggregate fields of "auth.user_roles" */
export type AuthUserRoles_Aggregate_Fields = {
  __typename?: 'authUserRoles_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<AuthUserRoles_Max_Fields>;
  min?: Maybe<AuthUserRoles_Min_Fields>;
};


/** aggregate fields of "auth.user_roles" */
export type AuthUserRoles_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<AuthUserRoles_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_roles" */
export type AuthUserRoles_Aggregate_Order_By = {
  count?: Maybe<Order_By>;
  max?: Maybe<AuthUserRoles_Max_Order_By>;
  min?: Maybe<AuthUserRoles_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.user_roles" */
export type AuthUserRoles_Arr_Rel_Insert_Input = {
  data: Array<AuthUserRoles_Insert_Input>;
  /** on conflict condition */
  on_conflict?: Maybe<AuthUserRoles_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
export type AuthUserRoles_Bool_Exp = {
  _and?: Maybe<Array<AuthUserRoles_Bool_Exp>>;
  _not?: Maybe<AuthUserRoles_Bool_Exp>;
  _or?: Maybe<Array<AuthUserRoles_Bool_Exp>>;
  createdAt?: Maybe<Timestamptz_Comparison_Exp>;
  id?: Maybe<Uuid_Comparison_Exp>;
  role?: Maybe<String_Comparison_Exp>;
  roleByRole?: Maybe<AuthRoles_Bool_Exp>;
  user?: Maybe<Users_Bool_Exp>;
  userId?: Maybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.user_roles" */
export enum AuthUserRoles_Constraint {
  /** unique or primary key constraint */
  UserRolesPkey = 'user_roles_pkey',
  /** unique or primary key constraint */
  UserRolesUserIdRoleKey = 'user_roles_user_id_role_key'
}

/** input type for inserting data into table "auth.user_roles" */
export type AuthUserRoles_Insert_Input = {
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  role?: Maybe<Scalars['String']>;
  roleByRole?: Maybe<AuthRoles_Obj_Rel_Insert_Input>;
  user?: Maybe<Users_Obj_Rel_Insert_Input>;
  userId?: Maybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type AuthUserRoles_Max_Fields = {
  __typename?: 'authUserRoles_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  role?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "auth.user_roles" */
export type AuthUserRoles_Max_Order_By = {
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  role?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** aggregate min on columns */
export type AuthUserRoles_Min_Fields = {
  __typename?: 'authUserRoles_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  role?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "auth.user_roles" */
export type AuthUserRoles_Min_Order_By = {
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  role?: Maybe<Order_By>;
  userId?: Maybe<Order_By>;
};

/** response of any mutation on the table "auth.user_roles" */
export type AuthUserRoles_Mutation_Response = {
  __typename?: 'authUserRoles_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserRoles>;
};

/** on conflict condition type for table "auth.user_roles" */
export type AuthUserRoles_On_Conflict = {
  constraint: AuthUserRoles_Constraint;
  update_columns?: Array<AuthUserRoles_Update_Column>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.user_roles". */
export type AuthUserRoles_Order_By = {
  createdAt?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  role?: Maybe<Order_By>;
  roleByRole?: Maybe<AuthRoles_Order_By>;
  user?: Maybe<Users_Order_By>;
  userId?: Maybe<Order_By>;
};

/** primary key columns input for table: authUserRoles */
export type AuthUserRoles_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "auth.user_roles" */
export enum AuthUserRoles_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Role = 'role',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "auth.user_roles" */
export type AuthUserRoles_Set_Input = {
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  role?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** update columns of table "auth.user_roles" */
export enum AuthUserRoles_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Role = 'role',
  /** column name */
  UserId = 'userId'
}


/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
export type Citext_Comparison_Exp = {
  _eq?: Maybe<Scalars['citext']>;
  _gt?: Maybe<Scalars['citext']>;
  _gte?: Maybe<Scalars['citext']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: Maybe<Scalars['citext']>;
  _in?: Maybe<Array<Scalars['citext']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: Maybe<Scalars['citext']>;
  _is_null?: Maybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: Maybe<Scalars['citext']>;
  _lt?: Maybe<Scalars['citext']>;
  _lte?: Maybe<Scalars['citext']>;
  _neq?: Maybe<Scalars['citext']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: Maybe<Scalars['citext']>;
  _nin?: Maybe<Array<Scalars['citext']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: Maybe<Scalars['citext']>;
  /** does the column NOT match the given pattern */
  _nlike?: Maybe<Scalars['citext']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: Maybe<Scalars['citext']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: Maybe<Scalars['citext']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: Maybe<Scalars['citext']>;
  /** does the column match the given SQL regular expression */
  _similar?: Maybe<Scalars['citext']>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  /** delete single row from the table: "auth.providers" */
  deleteAuthProvider?: Maybe<AuthProviders>;
  /** delete single row from the table: "auth.provider_requests" */
  deleteAuthProviderRequest?: Maybe<AuthProviderRequests>;
  /** delete data from the table: "auth.provider_requests" */
  deleteAuthProviderRequests?: Maybe<AuthProviderRequests_Mutation_Response>;
  /** delete data from the table: "auth.providers" */
  deleteAuthProviders?: Maybe<AuthProviders_Mutation_Response>;
  /** delete single row from the table: "auth.refresh_tokens" */
  deleteAuthRefreshToken?: Maybe<AuthRefreshTokens>;
  /** delete data from the table: "auth.refresh_tokens" */
  deleteAuthRefreshTokens?: Maybe<AuthRefreshTokens_Mutation_Response>;
  /** delete single row from the table: "auth.roles" */
  deleteAuthRole?: Maybe<AuthRoles>;
  /** delete data from the table: "auth.roles" */
  deleteAuthRoles?: Maybe<AuthRoles_Mutation_Response>;
  /** delete single row from the table: "auth.user_providers" */
  deleteAuthUserProvider?: Maybe<AuthUserProviders>;
  /** delete data from the table: "auth.user_providers" */
  deleteAuthUserProviders?: Maybe<AuthUserProviders_Mutation_Response>;
  /** delete single row from the table: "auth.user_roles" */
  deleteAuthUserRole?: Maybe<AuthUserRoles>;
  /** delete data from the table: "auth.user_roles" */
  deleteAuthUserRoles?: Maybe<AuthUserRoles_Mutation_Response>;
  /** delete single row from the table: "auth.users" */
  deleteUser?: Maybe<Users>;
  /** delete data from the table: "auth.users" */
  deleteUsers?: Maybe<Users_Mutation_Response>;
  /** insert a single row into the table: "auth.providers" */
  insertAuthProvider?: Maybe<AuthProviders>;
  /** insert a single row into the table: "auth.provider_requests" */
  insertAuthProviderRequest?: Maybe<AuthProviderRequests>;
  /** insert data into the table: "auth.provider_requests" */
  insertAuthProviderRequests?: Maybe<AuthProviderRequests_Mutation_Response>;
  /** insert data into the table: "auth.providers" */
  insertAuthProviders?: Maybe<AuthProviders_Mutation_Response>;
  /** insert a single row into the table: "auth.refresh_tokens" */
  insertAuthRefreshToken?: Maybe<AuthRefreshTokens>;
  /** insert data into the table: "auth.refresh_tokens" */
  insertAuthRefreshTokens?: Maybe<AuthRefreshTokens_Mutation_Response>;
  /** insert a single row into the table: "auth.roles" */
  insertAuthRole?: Maybe<AuthRoles>;
  /** insert data into the table: "auth.roles" */
  insertAuthRoles?: Maybe<AuthRoles_Mutation_Response>;
  /** insert a single row into the table: "auth.user_providers" */
  insertAuthUserProvider?: Maybe<AuthUserProviders>;
  /** insert data into the table: "auth.user_providers" */
  insertAuthUserProviders?: Maybe<AuthUserProviders_Mutation_Response>;
  /** insert a single row into the table: "auth.user_roles" */
  insertAuthUserRole?: Maybe<AuthUserRoles>;
  /** insert data into the table: "auth.user_roles" */
  insertAuthUserRoles?: Maybe<AuthUserRoles_Mutation_Response>;
  /** insert a single row into the table: "auth.users" */
  insertUser?: Maybe<Users>;
  /** insert data into the table: "auth.users" */
  insertUsers?: Maybe<Users_Mutation_Response>;
  /** update single row of the table: "auth.providers" */
  updateAuthProvider?: Maybe<AuthProviders>;
  /** update single row of the table: "auth.provider_requests" */
  updateAuthProviderRequest?: Maybe<AuthProviderRequests>;
  /** update data of the table: "auth.provider_requests" */
  updateAuthProviderRequests?: Maybe<AuthProviderRequests_Mutation_Response>;
  /** update data of the table: "auth.providers" */
  updateAuthProviders?: Maybe<AuthProviders_Mutation_Response>;
  /** update single row of the table: "auth.refresh_tokens" */
  updateAuthRefreshToken?: Maybe<AuthRefreshTokens>;
  /** update data of the table: "auth.refresh_tokens" */
  updateAuthRefreshTokens?: Maybe<AuthRefreshTokens_Mutation_Response>;
  /** update single row of the table: "auth.roles" */
  updateAuthRole?: Maybe<AuthRoles>;
  /** update data of the table: "auth.roles" */
  updateAuthRoles?: Maybe<AuthRoles_Mutation_Response>;
  /** update single row of the table: "auth.user_providers" */
  updateAuthUserProvider?: Maybe<AuthUserProviders>;
  /** update data of the table: "auth.user_providers" */
  updateAuthUserProviders?: Maybe<AuthUserProviders_Mutation_Response>;
  /** update single row of the table: "auth.user_roles" */
  updateAuthUserRole?: Maybe<AuthUserRoles>;
  /** update data of the table: "auth.user_roles" */
  updateAuthUserRoles?: Maybe<AuthUserRoles_Mutation_Response>;
  /** update single row of the table: "auth.users" */
  updateUser?: Maybe<Users>;
  /** update data of the table: "auth.users" */
  updateUsers?: Maybe<Users_Mutation_Response>;
};


/** mutation root */
export type Mutation_RootDeleteAuthProviderArgs = {
  id: Scalars['String'];
};


/** mutation root */
export type Mutation_RootDeleteAuthProviderRequestArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthProviderRequestsArgs = {
  where: AuthProviderRequests_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthProvidersArgs = {
  where: AuthProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthRefreshTokenArgs = {
  refreshToken: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthRefreshTokensArgs = {
  where: AuthRefreshTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthRoleArgs = {
  role: Scalars['String'];
};


/** mutation root */
export type Mutation_RootDeleteAuthRolesArgs = {
  where: AuthRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthUserProviderArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthUserProvidersArgs = {
  where: AuthUserProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthUserRoleArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthUserRolesArgs = {
  where: AuthUserRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteUserArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteUsersArgs = {
  where: Users_Bool_Exp;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderArgs = {
  object: AuthProviders_Insert_Input;
  on_conflict?: Maybe<AuthProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderRequestArgs = {
  object: AuthProviderRequests_Insert_Input;
  on_conflict?: Maybe<AuthProviderRequests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderRequestsArgs = {
  objects: Array<AuthProviderRequests_Insert_Input>;
  on_conflict?: Maybe<AuthProviderRequests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProvidersArgs = {
  objects: Array<AuthProviders_Insert_Input>;
  on_conflict?: Maybe<AuthProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRefreshTokenArgs = {
  object: AuthRefreshTokens_Insert_Input;
  on_conflict?: Maybe<AuthRefreshTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRefreshTokensArgs = {
  objects: Array<AuthRefreshTokens_Insert_Input>;
  on_conflict?: Maybe<AuthRefreshTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRoleArgs = {
  object: AuthRoles_Insert_Input;
  on_conflict?: Maybe<AuthRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRolesArgs = {
  objects: Array<AuthRoles_Insert_Input>;
  on_conflict?: Maybe<AuthRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserProviderArgs = {
  object: AuthUserProviders_Insert_Input;
  on_conflict?: Maybe<AuthUserProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserProvidersArgs = {
  objects: Array<AuthUserProviders_Insert_Input>;
  on_conflict?: Maybe<AuthUserProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserRoleArgs = {
  object: AuthUserRoles_Insert_Input;
  on_conflict?: Maybe<AuthUserRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserRolesArgs = {
  objects: Array<AuthUserRoles_Insert_Input>;
  on_conflict?: Maybe<AuthUserRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertUserArgs = {
  object: Users_Insert_Input;
  on_conflict?: Maybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertUsersArgs = {
  objects: Array<Users_Insert_Input>;
  on_conflict?: Maybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderArgs = {
  _set?: Maybe<AuthProviders_Set_Input>;
  pk_columns: AuthProviders_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderRequestArgs = {
  _set?: Maybe<AuthProviderRequests_Set_Input>;
  pk_columns: AuthProviderRequests_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderRequestsArgs = {
  _set?: Maybe<AuthProviderRequests_Set_Input>;
  where: AuthProviderRequests_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthProvidersArgs = {
  _set?: Maybe<AuthProviders_Set_Input>;
  where: AuthProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthRefreshTokenArgs = {
  _set?: Maybe<AuthRefreshTokens_Set_Input>;
  pk_columns: AuthRefreshTokens_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthRefreshTokensArgs = {
  _set?: Maybe<AuthRefreshTokens_Set_Input>;
  where: AuthRefreshTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthRoleArgs = {
  _set?: Maybe<AuthRoles_Set_Input>;
  pk_columns: AuthRoles_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthRolesArgs = {
  _set?: Maybe<AuthRoles_Set_Input>;
  where: AuthRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserProviderArgs = {
  _set?: Maybe<AuthUserProviders_Set_Input>;
  pk_columns: AuthUserProviders_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserProvidersArgs = {
  _set?: Maybe<AuthUserProviders_Set_Input>;
  where: AuthUserProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserRoleArgs = {
  _set?: Maybe<AuthUserRoles_Set_Input>;
  pk_columns: AuthUserRoles_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserRolesArgs = {
  _set?: Maybe<AuthUserRoles_Set_Input>;
  where: AuthUserRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateUserArgs = {
  _set?: Maybe<Users_Set_Input>;
  pk_columns: Users_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateUsersArgs = {
  _set?: Maybe<Users_Set_Input>;
  where: Users_Bool_Exp;
};

/** column ordering options */
export enum Order_By {
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

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "auth.providers" using primary key columns */
  authProvider?: Maybe<AuthProviders>;
  /** fetch data from the table: "auth.provider_requests" using primary key columns */
  authProviderRequest?: Maybe<AuthProviderRequests>;
  /** fetch data from the table: "auth.provider_requests" */
  authProviderRequests: Array<AuthProviderRequests>;
  /** fetch aggregated fields from the table: "auth.provider_requests" */
  authProviderRequestsAggregate: AuthProviderRequests_Aggregate;
  /** fetch data from the table: "auth.providers" */
  authProviders: Array<AuthProviders>;
  /** fetch aggregated fields from the table: "auth.providers" */
  authProvidersAggregate: AuthProviders_Aggregate;
  /** fetch data from the table: "auth.refresh_tokens" using primary key columns */
  authRefreshToken?: Maybe<AuthRefreshTokens>;
  /** fetch data from the table: "auth.refresh_tokens" */
  authRefreshTokens: Array<AuthRefreshTokens>;
  /** fetch aggregated fields from the table: "auth.refresh_tokens" */
  authRefreshTokensAggregate: AuthRefreshTokens_Aggregate;
  /** fetch data from the table: "auth.roles" using primary key columns */
  authRole?: Maybe<AuthRoles>;
  /** fetch data from the table: "auth.roles" */
  authRoles: Array<AuthRoles>;
  /** fetch aggregated fields from the table: "auth.roles" */
  authRolesAggregate: AuthRoles_Aggregate;
  /** fetch data from the table: "auth.user_providers" using primary key columns */
  authUserProvider?: Maybe<AuthUserProviders>;
  /** fetch data from the table: "auth.user_providers" */
  authUserProviders: Array<AuthUserProviders>;
  /** fetch aggregated fields from the table: "auth.user_providers" */
  authUserProvidersAggregate: AuthUserProviders_Aggregate;
  /** fetch data from the table: "auth.user_roles" using primary key columns */
  authUserRole?: Maybe<AuthUserRoles>;
  /** fetch data from the table: "auth.user_roles" */
  authUserRoles: Array<AuthUserRoles>;
  /** fetch aggregated fields from the table: "auth.user_roles" */
  authUserRolesAggregate: AuthUserRoles_Aggregate;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch aggregated fields from the table: "auth.users" */
  userAggregate: Users_Aggregate;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
};


export type Query_RootAuthProviderArgs = {
  id: Scalars['String'];
};


export type Query_RootAuthProviderRequestArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthProviderRequestsArgs = {
  distinct_on?: Maybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviderRequests_Order_By>>;
  where?: Maybe<AuthProviderRequests_Bool_Exp>;
};


export type Query_RootAuthProviderRequestsAggregateArgs = {
  distinct_on?: Maybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviderRequests_Order_By>>;
  where?: Maybe<AuthProviderRequests_Bool_Exp>;
};


export type Query_RootAuthProvidersArgs = {
  distinct_on?: Maybe<Array<AuthProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviders_Order_By>>;
  where?: Maybe<AuthProviders_Bool_Exp>;
};


export type Query_RootAuthProvidersAggregateArgs = {
  distinct_on?: Maybe<Array<AuthProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviders_Order_By>>;
  where?: Maybe<AuthProviders_Bool_Exp>;
};


export type Query_RootAuthRefreshTokenArgs = {
  refreshToken: Scalars['uuid'];
};


export type Query_RootAuthRefreshTokensArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


export type Query_RootAuthRefreshTokensAggregateArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


export type Query_RootAuthRoleArgs = {
  role: Scalars['String'];
};


export type Query_RootAuthRolesArgs = {
  distinct_on?: Maybe<Array<AuthRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRoles_Order_By>>;
  where?: Maybe<AuthRoles_Bool_Exp>;
};


export type Query_RootAuthRolesAggregateArgs = {
  distinct_on?: Maybe<Array<AuthRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRoles_Order_By>>;
  where?: Maybe<AuthRoles_Bool_Exp>;
};


export type Query_RootAuthUserProviderArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthUserProvidersArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


export type Query_RootAuthUserProvidersAggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


export type Query_RootAuthUserRoleArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthUserRolesArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


export type Query_RootAuthUserRolesAggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


export type Query_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Query_RootUserAggregateArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};


export type Query_RootUsersArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "auth.providers" using primary key columns */
  authProvider?: Maybe<AuthProviders>;
  /** fetch data from the table: "auth.provider_requests" using primary key columns */
  authProviderRequest?: Maybe<AuthProviderRequests>;
  /** fetch data from the table: "auth.provider_requests" */
  authProviderRequests: Array<AuthProviderRequests>;
  /** fetch aggregated fields from the table: "auth.provider_requests" */
  authProviderRequestsAggregate: AuthProviderRequests_Aggregate;
  /** fetch data from the table: "auth.providers" */
  authProviders: Array<AuthProviders>;
  /** fetch aggregated fields from the table: "auth.providers" */
  authProvidersAggregate: AuthProviders_Aggregate;
  /** fetch data from the table: "auth.refresh_tokens" using primary key columns */
  authRefreshToken?: Maybe<AuthRefreshTokens>;
  /** fetch data from the table: "auth.refresh_tokens" */
  authRefreshTokens: Array<AuthRefreshTokens>;
  /** fetch aggregated fields from the table: "auth.refresh_tokens" */
  authRefreshTokensAggregate: AuthRefreshTokens_Aggregate;
  /** fetch data from the table: "auth.roles" using primary key columns */
  authRole?: Maybe<AuthRoles>;
  /** fetch data from the table: "auth.roles" */
  authRoles: Array<AuthRoles>;
  /** fetch aggregated fields from the table: "auth.roles" */
  authRolesAggregate: AuthRoles_Aggregate;
  /** fetch data from the table: "auth.user_providers" using primary key columns */
  authUserProvider?: Maybe<AuthUserProviders>;
  /** fetch data from the table: "auth.user_providers" */
  authUserProviders: Array<AuthUserProviders>;
  /** fetch aggregated fields from the table: "auth.user_providers" */
  authUserProvidersAggregate: AuthUserProviders_Aggregate;
  /** fetch data from the table: "auth.user_roles" using primary key columns */
  authUserRole?: Maybe<AuthUserRoles>;
  /** fetch data from the table: "auth.user_roles" */
  authUserRoles: Array<AuthUserRoles>;
  /** fetch aggregated fields from the table: "auth.user_roles" */
  authUserRolesAggregate: AuthUserRoles_Aggregate;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch aggregated fields from the table: "auth.users" */
  userAggregate: Users_Aggregate;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
};


export type Subscription_RootAuthProviderArgs = {
  id: Scalars['String'];
};


export type Subscription_RootAuthProviderRequestArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthProviderRequestsArgs = {
  distinct_on?: Maybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviderRequests_Order_By>>;
  where?: Maybe<AuthProviderRequests_Bool_Exp>;
};


export type Subscription_RootAuthProviderRequestsAggregateArgs = {
  distinct_on?: Maybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviderRequests_Order_By>>;
  where?: Maybe<AuthProviderRequests_Bool_Exp>;
};


export type Subscription_RootAuthProvidersArgs = {
  distinct_on?: Maybe<Array<AuthProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviders_Order_By>>;
  where?: Maybe<AuthProviders_Bool_Exp>;
};


export type Subscription_RootAuthProvidersAggregateArgs = {
  distinct_on?: Maybe<Array<AuthProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthProviders_Order_By>>;
  where?: Maybe<AuthProviders_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokenArgs = {
  refreshToken: Scalars['uuid'];
};


export type Subscription_RootAuthRefreshTokensArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokensAggregateArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRoleArgs = {
  role: Scalars['String'];
};


export type Subscription_RootAuthRolesArgs = {
  distinct_on?: Maybe<Array<AuthRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRoles_Order_By>>;
  where?: Maybe<AuthRoles_Bool_Exp>;
};


export type Subscription_RootAuthRolesAggregateArgs = {
  distinct_on?: Maybe<Array<AuthRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRoles_Order_By>>;
  where?: Maybe<AuthRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserProviderArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthUserProvidersArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


export type Subscription_RootAuthUserProvidersAggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


export type Subscription_RootAuthUserRoleArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthUserRolesArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserRolesAggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


export type Subscription_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootUserAggregateArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};


export type Subscription_RootUsersArgs = {
  distinct_on?: Maybe<Array<Users_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<Users_Order_By>>;
  where?: Maybe<Users_Bool_Exp>;
};


/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: Maybe<Scalars['timestamptz']>;
  _gt?: Maybe<Scalars['timestamptz']>;
  _gte?: Maybe<Scalars['timestamptz']>;
  _in?: Maybe<Array<Scalars['timestamptz']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _lt?: Maybe<Scalars['timestamptz']>;
  _lte?: Maybe<Scalars['timestamptz']>;
  _neq?: Maybe<Scalars['timestamptz']>;
  _nin?: Maybe<Array<Scalars['timestamptz']>>;
};

/** columns and relationships of "auth.users" */
export type Users = {
  __typename?: 'users';
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  defaultRole: Scalars['String'];
  /** An object relationship */
  defaultRoleByRole: AuthRoles;
  disabled: Scalars['Boolean'];
  displayName: Scalars['String'];
  email?: Maybe<Scalars['citext']>;
  emailVerified: Scalars['Boolean'];
  id: Scalars['uuid'];
  isAnonymous: Scalars['Boolean'];
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale: Scalars['String'];
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt: Scalars['timestamptz'];
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  phoneNumberVerified: Scalars['Boolean'];
  /** An array relationship */
  refreshTokens: Array<AuthRefreshTokens>;
  /** An aggregate relationship */
  refreshTokens_aggregate: AuthRefreshTokens_Aggregate;
  /** An array relationship */
  roles: Array<AuthUserRoles>;
  /** An aggregate relationship */
  roles_aggregate: AuthUserRoles_Aggregate;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt: Scalars['timestamptz'];
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt: Scalars['timestamptz'];
  /** An array relationship */
  userProviders: Array<AuthUserProviders>;
  /** An aggregate relationship */
  userProviders_aggregate: AuthUserProviders_Aggregate;
};


/** columns and relationships of "auth.users" */
export type UsersRefreshTokensArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


/** columns and relationships of "auth.users" */
export type UsersRefreshTokens_AggregateArgs = {
  distinct_on?: Maybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthRefreshTokens_Order_By>>;
  where?: Maybe<AuthRefreshTokens_Bool_Exp>;
};


/** columns and relationships of "auth.users" */
export type UsersRolesArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


/** columns and relationships of "auth.users" */
export type UsersRoles_AggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserRoles_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserRoles_Order_By>>;
  where?: Maybe<AuthUserRoles_Bool_Exp>;
};


/** columns and relationships of "auth.users" */
export type UsersUserProvidersArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};


/** columns and relationships of "auth.users" */
export type UsersUserProviders_AggregateArgs = {
  distinct_on?: Maybe<Array<AuthUserProviders_Select_Column>>;
  limit?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  order_by?: Maybe<Array<AuthUserProviders_Order_By>>;
  where?: Maybe<AuthUserProviders_Bool_Exp>;
};

/** aggregated selection of "auth.users" */
export type Users_Aggregate = {
  __typename?: 'users_aggregate';
  aggregate?: Maybe<Users_Aggregate_Fields>;
  nodes: Array<Users>;
};

/** aggregate fields of "auth.users" */
export type Users_Aggregate_Fields = {
  __typename?: 'users_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Users_Max_Fields>;
  min?: Maybe<Users_Min_Fields>;
};


/** aggregate fields of "auth.users" */
export type Users_Aggregate_FieldsCountArgs = {
  columns?: Maybe<Array<Users_Select_Column>>;
  distinct?: Maybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.users" */
export type Users_Aggregate_Order_By = {
  count?: Maybe<Order_By>;
  max?: Maybe<Users_Max_Order_By>;
  min?: Maybe<Users_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.users" */
export type Users_Arr_Rel_Insert_Input = {
  data: Array<Users_Insert_Input>;
  /** on conflict condition */
  on_conflict?: Maybe<Users_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
export type Users_Bool_Exp = {
  _and?: Maybe<Array<Users_Bool_Exp>>;
  _not?: Maybe<Users_Bool_Exp>;
  _or?: Maybe<Array<Users_Bool_Exp>>;
  activeMfaType?: Maybe<String_Comparison_Exp>;
  avatarUrl?: Maybe<String_Comparison_Exp>;
  createdAt?: Maybe<Timestamptz_Comparison_Exp>;
  defaultRole?: Maybe<String_Comparison_Exp>;
  defaultRoleByRole?: Maybe<AuthRoles_Bool_Exp>;
  disabled?: Maybe<Boolean_Comparison_Exp>;
  displayName?: Maybe<String_Comparison_Exp>;
  email?: Maybe<Citext_Comparison_Exp>;
  emailVerified?: Maybe<Boolean_Comparison_Exp>;
  id?: Maybe<Uuid_Comparison_Exp>;
  isAnonymous?: Maybe<Boolean_Comparison_Exp>;
  lastSeen?: Maybe<Timestamptz_Comparison_Exp>;
  locale?: Maybe<String_Comparison_Exp>;
  newEmail?: Maybe<Citext_Comparison_Exp>;
  otpHash?: Maybe<String_Comparison_Exp>;
  otpHashExpiresAt?: Maybe<Timestamptz_Comparison_Exp>;
  otpMethodLastUsed?: Maybe<String_Comparison_Exp>;
  passwordHash?: Maybe<String_Comparison_Exp>;
  phoneNumber?: Maybe<String_Comparison_Exp>;
  phoneNumberVerified?: Maybe<Boolean_Comparison_Exp>;
  refreshTokens?: Maybe<AuthRefreshTokens_Bool_Exp>;
  roles?: Maybe<AuthUserRoles_Bool_Exp>;
  ticket?: Maybe<String_Comparison_Exp>;
  ticketExpiresAt?: Maybe<Timestamptz_Comparison_Exp>;
  totpSecret?: Maybe<String_Comparison_Exp>;
  updatedAt?: Maybe<Timestamptz_Comparison_Exp>;
  userProviders?: Maybe<AuthUserProviders_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.users" */
export enum Users_Constraint {
  /** unique or primary key constraint */
  UsersEmailKey = 'users_email_key',
  /** unique or primary key constraint */
  UsersPhoneNumberKey = 'users_phone_number_key',
  /** unique or primary key constraint */
  UsersPkey = 'users_pkey'
}

/** input type for inserting data into table "auth.users" */
export type Users_Insert_Input = {
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  defaultRole?: Maybe<Scalars['String']>;
  defaultRoleByRole?: Maybe<AuthRoles_Obj_Rel_Insert_Input>;
  disabled?: Maybe<Scalars['Boolean']>;
  displayName?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['citext']>;
  emailVerified?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['uuid']>;
  isAnonymous?: Maybe<Scalars['Boolean']>;
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale?: Maybe<Scalars['String']>;
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt?: Maybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  phoneNumberVerified?: Maybe<Scalars['Boolean']>;
  refreshTokens?: Maybe<AuthRefreshTokens_Arr_Rel_Insert_Input>;
  roles?: Maybe<AuthUserRoles_Arr_Rel_Insert_Input>;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt?: Maybe<Scalars['timestamptz']>;
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userProviders?: Maybe<AuthUserProviders_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Users_Max_Fields = {
  __typename?: 'users_max_fields';
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  defaultRole?: Maybe<Scalars['String']>;
  displayName?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['citext']>;
  id?: Maybe<Scalars['uuid']>;
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale?: Maybe<Scalars['String']>;
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt?: Maybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt?: Maybe<Scalars['timestamptz']>;
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "auth.users" */
export type Users_Max_Order_By = {
  activeMfaType?: Maybe<Order_By>;
  avatarUrl?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  defaultRole?: Maybe<Order_By>;
  displayName?: Maybe<Order_By>;
  email?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  lastSeen?: Maybe<Order_By>;
  locale?: Maybe<Order_By>;
  newEmail?: Maybe<Order_By>;
  otpHash?: Maybe<Order_By>;
  otpHashExpiresAt?: Maybe<Order_By>;
  otpMethodLastUsed?: Maybe<Order_By>;
  passwordHash?: Maybe<Order_By>;
  phoneNumber?: Maybe<Order_By>;
  ticket?: Maybe<Order_By>;
  ticketExpiresAt?: Maybe<Order_By>;
  totpSecret?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
};

/** aggregate min on columns */
export type Users_Min_Fields = {
  __typename?: 'users_min_fields';
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  defaultRole?: Maybe<Scalars['String']>;
  displayName?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['citext']>;
  id?: Maybe<Scalars['uuid']>;
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale?: Maybe<Scalars['String']>;
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt?: Maybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt?: Maybe<Scalars['timestamptz']>;
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "auth.users" */
export type Users_Min_Order_By = {
  activeMfaType?: Maybe<Order_By>;
  avatarUrl?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  defaultRole?: Maybe<Order_By>;
  displayName?: Maybe<Order_By>;
  email?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  lastSeen?: Maybe<Order_By>;
  locale?: Maybe<Order_By>;
  newEmail?: Maybe<Order_By>;
  otpHash?: Maybe<Order_By>;
  otpHashExpiresAt?: Maybe<Order_By>;
  otpMethodLastUsed?: Maybe<Order_By>;
  passwordHash?: Maybe<Order_By>;
  phoneNumber?: Maybe<Order_By>;
  ticket?: Maybe<Order_By>;
  ticketExpiresAt?: Maybe<Order_By>;
  totpSecret?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
};

/** response of any mutation on the table "auth.users" */
export type Users_Mutation_Response = {
  __typename?: 'users_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Users>;
};

/** input type for inserting object relation for remote table "auth.users" */
export type Users_Obj_Rel_Insert_Input = {
  data: Users_Insert_Input;
  /** on conflict condition */
  on_conflict?: Maybe<Users_On_Conflict>;
};

/** on conflict condition type for table "auth.users" */
export type Users_On_Conflict = {
  constraint: Users_Constraint;
  update_columns?: Array<Users_Update_Column>;
  where?: Maybe<Users_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.users". */
export type Users_Order_By = {
  activeMfaType?: Maybe<Order_By>;
  avatarUrl?: Maybe<Order_By>;
  createdAt?: Maybe<Order_By>;
  defaultRole?: Maybe<Order_By>;
  defaultRoleByRole?: Maybe<AuthRoles_Order_By>;
  disabled?: Maybe<Order_By>;
  displayName?: Maybe<Order_By>;
  email?: Maybe<Order_By>;
  emailVerified?: Maybe<Order_By>;
  id?: Maybe<Order_By>;
  isAnonymous?: Maybe<Order_By>;
  lastSeen?: Maybe<Order_By>;
  locale?: Maybe<Order_By>;
  newEmail?: Maybe<Order_By>;
  otpHash?: Maybe<Order_By>;
  otpHashExpiresAt?: Maybe<Order_By>;
  otpMethodLastUsed?: Maybe<Order_By>;
  passwordHash?: Maybe<Order_By>;
  phoneNumber?: Maybe<Order_By>;
  phoneNumberVerified?: Maybe<Order_By>;
  refreshTokens_aggregate?: Maybe<AuthRefreshTokens_Aggregate_Order_By>;
  roles_aggregate?: Maybe<AuthUserRoles_Aggregate_Order_By>;
  ticket?: Maybe<Order_By>;
  ticketExpiresAt?: Maybe<Order_By>;
  totpSecret?: Maybe<Order_By>;
  updatedAt?: Maybe<Order_By>;
  userProviders_aggregate?: Maybe<AuthUserProviders_Aggregate_Order_By>;
};

/** primary key columns input for table: users */
export type Users_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "auth.users" */
export enum Users_Select_Column {
  /** column name */
  ActiveMfaType = 'activeMfaType',
  /** column name */
  AvatarUrl = 'avatarUrl',
  /** column name */
  CreatedAt = 'createdAt',
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
  NewEmail = 'newEmail',
  /** column name */
  OtpHash = 'otpHash',
  /** column name */
  OtpHashExpiresAt = 'otpHashExpiresAt',
  /** column name */
  OtpMethodLastUsed = 'otpMethodLastUsed',
  /** column name */
  PasswordHash = 'passwordHash',
  /** column name */
  PhoneNumber = 'phoneNumber',
  /** column name */
  PhoneNumberVerified = 'phoneNumberVerified',
  /** column name */
  Ticket = 'ticket',
  /** column name */
  TicketExpiresAt = 'ticketExpiresAt',
  /** column name */
  TotpSecret = 'totpSecret',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "auth.users" */
export type Users_Set_Input = {
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  defaultRole?: Maybe<Scalars['String']>;
  disabled?: Maybe<Scalars['Boolean']>;
  displayName?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['citext']>;
  emailVerified?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['uuid']>;
  isAnonymous?: Maybe<Scalars['Boolean']>;
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale?: Maybe<Scalars['String']>;
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt?: Maybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  phoneNumberVerified?: Maybe<Scalars['Boolean']>;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt?: Maybe<Scalars['timestamptz']>;
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** update columns of table "auth.users" */
export enum Users_Update_Column {
  /** column name */
  ActiveMfaType = 'activeMfaType',
  /** column name */
  AvatarUrl = 'avatarUrl',
  /** column name */
  CreatedAt = 'createdAt',
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
  NewEmail = 'newEmail',
  /** column name */
  OtpHash = 'otpHash',
  /** column name */
  OtpHashExpiresAt = 'otpHashExpiresAt',
  /** column name */
  OtpMethodLastUsed = 'otpMethodLastUsed',
  /** column name */
  PasswordHash = 'passwordHash',
  /** column name */
  PhoneNumber = 'phoneNumber',
  /** column name */
  PhoneNumberVerified = 'phoneNumberVerified',
  /** column name */
  Ticket = 'ticket',
  /** column name */
  TicketExpiresAt = 'ticketExpiresAt',
  /** column name */
  TotpSecret = 'totpSecret',
  /** column name */
  UpdatedAt = 'updatedAt'
}


/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: Maybe<Scalars['uuid']>;
  _gt?: Maybe<Scalars['uuid']>;
  _gte?: Maybe<Scalars['uuid']>;
  _in?: Maybe<Array<Scalars['uuid']>>;
  _is_null?: Maybe<Scalars['Boolean']>;
  _lt?: Maybe<Scalars['uuid']>;
  _lte?: Maybe<Scalars['uuid']>;
  _neq?: Maybe<Scalars['uuid']>;
  _nin?: Maybe<Array<Scalars['uuid']>>;
};

export type InsertProviderRequestMutationVariables = Exact<{
  providerRequest: AuthProviderRequests_Insert_Input;
}>;


export type InsertProviderRequestMutation = (
  { __typename?: 'mutation_root' }
  & { insertAuthProviderRequest?: Maybe<(
    { __typename?: 'authProviderRequests' }
    & Pick<AuthProviderRequests, 'id' | 'redirectUrl'>
  )> }
);

export type DeleteProviderRequestMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteProviderRequestMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthProviderRequest?: Maybe<(
    { __typename?: 'authProviderRequests' }
    & Pick<AuthProviderRequests, 'id' | 'redirectUrl'>
  )> }
);

export type ProviderRequestQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type ProviderRequestQuery = (
  { __typename?: 'query_root' }
  & { authProviderRequest?: Maybe<(
    { __typename?: 'authProviderRequests' }
    & Pick<AuthProviderRequests, 'id' | 'redirectUrl'>
  )> }
);

export type InsertRefreshTokenMutationVariables = Exact<{
  refreshToken: AuthRefreshTokens_Insert_Input;
}>;


export type InsertRefreshTokenMutation = (
  { __typename?: 'mutation_root' }
  & { insertAuthRefreshToken?: Maybe<(
    { __typename?: 'authRefreshTokens' }
    & Pick<AuthRefreshTokens, 'refreshToken'>
  )> }
);

export type DeleteRefreshTokenMutationVariables = Exact<{
  refreshToken: Scalars['uuid'];
}>;


export type DeleteRefreshTokenMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthRefreshToken?: Maybe<(
    { __typename?: 'authRefreshTokens' }
    & Pick<AuthRefreshTokens, 'refreshToken' | 'expiresAt'>
  )> }
);

export type DeleteUserRefreshTokensMutationVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type DeleteUserRefreshTokensMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthRefreshTokens?: Maybe<(
    { __typename?: 'authRefreshTokens_mutation_response' }
    & Pick<AuthRefreshTokens_Mutation_Response, 'affected_rows'>
  )> }
);

export type DeleteExpiredRefreshTokensMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteExpiredRefreshTokensMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthRefreshTokens?: Maybe<(
    { __typename?: 'authRefreshTokens_mutation_response' }
    & Pick<AuthRefreshTokens_Mutation_Response, 'affected_rows'>
  )> }
);

export type AuthUserProvidersQueryVariables = Exact<{
  provider: Scalars['String'];
  providerUserId: Scalars['String'];
}>;


export type AuthUserProvidersQuery = (
  { __typename?: 'query_root' }
  & { authUserProviders: Array<(
    { __typename?: 'authUserProviders' }
    & Pick<AuthUserProviders, 'id'>
    & { user: (
      { __typename?: 'users' }
      & Pick<Users, 'id'>
    ) }
  )> }
);

export type UserProviderQueryVariables = Exact<{
  userId: Scalars['uuid'];
  providerId: Scalars['String'];
}>;


export type UserProviderQuery = (
  { __typename?: 'query_root' }
  & { authUserProviders: Array<(
    { __typename?: 'authUserProviders' }
    & Pick<AuthUserProviders, 'id' | 'refreshToken'>
  )> }
);

export type UpdateAuthUserproviderMutationVariables = Exact<{
  id: Scalars['uuid'];
  authUserProvider: AuthUserProviders_Set_Input;
}>;


export type UpdateAuthUserproviderMutation = (
  { __typename?: 'mutation_root' }
  & { updateAuthUserProvider?: Maybe<(
    { __typename?: 'authUserProviders' }
    & Pick<AuthUserProviders, 'id'>
  )> }
);

export type InsertUserRolesMutationVariables = Exact<{
  userRoles: Array<AuthUserRoles_Insert_Input> | AuthUserRoles_Insert_Input;
}>;


export type InsertUserRolesMutation = (
  { __typename?: 'mutation_root' }
  & { insertAuthUserRoles?: Maybe<(
    { __typename?: 'authUserRoles_mutation_response' }
    & Pick<AuthUserRoles_Mutation_Response, 'affected_rows'>
  )> }
);

export type DeleteUserRolesByUserIdMutationVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type DeleteUserRolesByUserIdMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthUserRoles?: Maybe<(
    { __typename?: 'authUserRoles_mutation_response' }
    & Pick<AuthUserRoles_Mutation_Response, 'affected_rows'>
  )> }
);

export type UserFieldsFragment = (
  { __typename?: 'users' }
  & Pick<Users, 'id' | 'createdAt' | 'disabled' | 'displayName' | 'avatarUrl' | 'email' | 'passwordHash' | 'emailVerified' | 'phoneNumberVerified' | 'defaultRole' | 'isAnonymous' | 'ticket' | 'otpHash' | 'totpSecret' | 'activeMfaType' | 'newEmail' | 'locale'>
  & { roles: Array<(
    { __typename?: 'authUserRoles' }
    & Pick<AuthUserRoles, 'role'>
  )> }
);

export type UserQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type UserQuery = (
  { __typename?: 'query_root' }
  & { user?: Maybe<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type UsersQueryVariables = Exact<{
  where: Users_Bool_Exp;
}>;


export type UsersQuery = (
  { __typename?: 'query_root' }
  & { users: Array<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtMutationVariables = Exact<{
  refreshToken: Scalars['uuid'];
  expiresAt: Scalars['timestamptz'];
}>;


export type GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtMutation = (
  { __typename?: 'mutation_root' }
  & { updateAuthRefreshTokens?: Maybe<(
    { __typename?: 'authRefreshTokens_mutation_response' }
    & { returning: Array<(
      { __typename?: 'authRefreshTokens' }
      & Pick<AuthRefreshTokens, 'refreshToken'>
      & { user: (
        { __typename?: 'users' }
        & UserFieldsFragment
      ) }
    )> }
  )> }
);

export type GetUsersByRefreshTokenOldQueryVariables = Exact<{
  refreshToken: Scalars['uuid'];
}>;


export type GetUsersByRefreshTokenOldQuery = (
  { __typename?: 'query_root' }
  & { authRefreshTokens: Array<(
    { __typename?: 'authRefreshTokens' }
    & Pick<AuthRefreshTokens, 'refreshToken'>
    & { user: (
      { __typename?: 'users' }
      & UserFieldsFragment
    ) }
  )> }
);

export type UpdateUserMutationVariables = Exact<{
  id: Scalars['uuid'];
  user: Users_Set_Input;
}>;


export type UpdateUserMutation = (
  { __typename?: 'mutation_root' }
  & { updateUser?: Maybe<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type UpdateUserWhereMutationVariables = Exact<{
  where: Users_Bool_Exp;
  user: Users_Set_Input;
}>;


export type UpdateUserWhereMutation = (
  { __typename?: 'mutation_root' }
  & { updateUsers?: Maybe<(
    { __typename?: 'users_mutation_response' }
    & Pick<Users_Mutation_Response, 'affected_rows'>
  )> }
);

export type RotateUsersTicketMutationVariables = Exact<{
  oldTicket: Scalars['String'];
  newTicket: Scalars['String'];
  newTicketExpiresAt: Scalars['timestamptz'];
}>;


export type RotateUsersTicketMutation = (
  { __typename?: 'mutation_root' }
  & { updateUsers?: Maybe<(
    { __typename?: 'users_mutation_response' }
    & Pick<Users_Mutation_Response, 'affected_rows'>
  )> }
);

export type ChangeEmailsByTicketMutationVariables = Exact<{
  ticket: Scalars['String'];
  email: Scalars['citext'];
  newTicket: Scalars['String'];
  now: Scalars['timestamptz'];
}>;


export type ChangeEmailsByTicketMutation = (
  { __typename?: 'mutation_root' }
  & { updateUsers?: Maybe<(
    { __typename?: 'users_mutation_response' }
    & { returning: Array<(
      { __typename?: 'users' }
      & UserFieldsFragment
    )> }
  )> }
);

export type InsertUserMutationVariables = Exact<{
  user: Users_Insert_Input;
}>;


export type InsertUserMutation = (
  { __typename?: 'mutation_root' }
  & { insertUser?: Maybe<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type DeleteUserMutationVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type DeleteUserMutation = (
  { __typename?: 'mutation_root' }
  & { deleteAuthUserRoles?: Maybe<(
    { __typename?: 'authUserRoles_mutation_response' }
    & Pick<AuthUserRoles_Mutation_Response, 'affected_rows'>
  )>, deleteUser?: Maybe<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type DeanonymizeUserMutationVariables = Exact<{
  userId: Scalars['uuid'];
  avatarUrl?: Maybe<Scalars['String']>;
  role: Scalars['String'];
}>;


export type DeanonymizeUserMutation = (
  { __typename?: 'mutation_root' }
  & { updateAuthUserRoles?: Maybe<(
    { __typename?: 'authUserRoles_mutation_response' }
    & Pick<AuthUserRoles_Mutation_Response, 'affected_rows'>
  )>, updateUser?: Maybe<(
    { __typename?: 'users' }
    & Pick<Users, 'id'>
  )> }
);

export type InsertUserProviderToUserMutationVariables = Exact<{
  userProvider: AuthUserProviders_Insert_Input;
}>;


export type InsertUserProviderToUserMutation = (
  { __typename?: 'mutation_root' }
  & { insertAuthUserProvider?: Maybe<(
    { __typename?: 'authUserProviders' }
    & Pick<AuthUserProviders, 'id'>
  )> }
);

export type GetUserByTicketQueryVariables = Exact<{
  ticket: Scalars['String'];
}>;


export type GetUserByTicketQuery = (
  { __typename?: 'query_root' }
  & { users: Array<(
    { __typename?: 'users' }
    & UserFieldsFragment
  )> }
);

export type UpdateUsersByTicketMutationVariables = Exact<{
  ticket: Scalars['String'];
  user: Users_Set_Input;
}>;


export type UpdateUsersByTicketMutation = (
  { __typename?: 'mutation_root' }
  & { updateUsers?: Maybe<(
    { __typename?: 'users_mutation_response' }
    & Pick<Users_Mutation_Response, 'affected_rows'>
    & { returning: Array<(
      { __typename?: 'users' }
      & UserFieldsFragment
    )> }
  )> }
);

export const UserFieldsFragmentDoc = gql`
    fragment userFields on users {
  id
  createdAt
  disabled
  displayName
  avatarUrl
  email
  passwordHash
  emailVerified
  phoneNumberVerified
  defaultRole
  roles {
    role
  }
  isAnonymous
  ticket
  otpHash
  totpSecret
  activeMfaType
  newEmail
  locale
  roles {
    role
  }
}
    `;
export const InsertProviderRequestDocument = gql`
    mutation insertProviderRequest($providerRequest: authProviderRequests_insert_input!) {
  insertAuthProviderRequest(object: $providerRequest) {
    id
    redirectUrl
  }
}
    `;
export const DeleteProviderRequestDocument = gql`
    mutation deleteProviderRequest($id: uuid!) {
  deleteAuthProviderRequest(id: $id) {
    id
    redirectUrl
  }
}
    `;
export const ProviderRequestDocument = gql`
    query providerRequest($id: uuid!) {
  authProviderRequest(id: $id) {
    id
    redirectUrl
  }
}
    `;
export const InsertRefreshTokenDocument = gql`
    mutation insertRefreshToken($refreshToken: authRefreshTokens_insert_input!) {
  insertAuthRefreshToken(object: $refreshToken) {
    refreshToken
  }
}
    `;
export const DeleteRefreshTokenDocument = gql`
    mutation deleteRefreshToken($refreshToken: uuid!) {
  deleteAuthRefreshToken(refreshToken: $refreshToken) {
    refreshToken
    expiresAt
  }
}
    `;
export const DeleteUserRefreshTokensDocument = gql`
    mutation deleteUserRefreshTokens($userId: uuid!) {
  deleteAuthRefreshTokens(where: {user: {id: {_eq: $userId}}}) {
    affected_rows
  }
}
    `;
export const DeleteExpiredRefreshTokensDocument = gql`
    mutation deleteExpiredRefreshTokens {
  deleteAuthRefreshTokens(where: {expiresAt: {_lt: now}}) {
    affected_rows
  }
}
    `;
export const AuthUserProvidersDocument = gql`
    query authUserProviders($provider: String!, $providerUserId: String!) {
  authUserProviders(where: {_and: {provider: {id: {_eq: $provider}}, providerUserId: {_eq: $providerUserId}}}, limit: 1) {
    id
    user {
      id
    }
  }
}
    `;
export const UserProviderDocument = gql`
    query userProvider($userId: uuid!, $providerId: String!) {
  authUserProviders(where: {_and: [{userId: {_eq: $userId}}, {providerId: {_eq: $providerId}}]}, limit: 1) {
    id
    refreshToken
  }
}
    `;
export const UpdateAuthUserproviderDocument = gql`
    mutation updateAuthUserprovider($id: uuid!, $authUserProvider: authUserProviders_set_input!) {
  updateAuthUserProvider(pk_columns: {id: $id}, _set: $authUserProvider) {
    id
  }
}
    `;
export const InsertUserRolesDocument = gql`
    mutation insertUserRoles($userRoles: [authUserRoles_insert_input!]!) {
  insertAuthUserRoles(objects: $userRoles) {
    affected_rows
  }
}
    `;
export const DeleteUserRolesByUserIdDocument = gql`
    mutation deleteUserRolesByUserId($userId: uuid!) {
  deleteAuthUserRoles(where: {userId: {_eq: $userId}}) {
    affected_rows
  }
}
    `;
export const UserDocument = gql`
    query user($id: uuid!) {
  user(id: $id) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const UsersDocument = gql`
    query users($where: users_bool_exp!) {
  users(where: $where) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtDocument = gql`
    mutation getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt($refreshToken: uuid!, $expiresAt: timestamptz!) {
  updateAuthRefreshTokens(_set: {expiresAt: $expiresAt}, where: {_and: [{refreshToken: {_eq: $refreshToken}}, {user: {disabled: {_eq: false}}}, {expiresAt: {_gte: now}}]}) {
    returning {
      refreshToken
      user {
        ...userFields
      }
    }
  }
}
    ${UserFieldsFragmentDoc}`;
export const GetUsersByRefreshTokenOldDocument = gql`
    query getUsersByRefreshTokenOld($refreshToken: uuid!) {
  authRefreshTokens(where: {_and: [{refreshToken: {_eq: $refreshToken}}, {user: {disabled: {_eq: false}}}, {expiresAt: {_gte: now}}]}) {
    refreshToken
    user {
      ...userFields
    }
  }
}
    ${UserFieldsFragmentDoc}`;
export const UpdateUserDocument = gql`
    mutation updateUser($id: uuid!, $user: users_set_input!) {
  updateUser(pk_columns: {id: $id}, _set: $user) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const UpdateUserWhereDocument = gql`
    mutation updateUserWhere($where: users_bool_exp!, $user: users_set_input!) {
  updateUsers(where: $where, _set: $user) {
    affected_rows
  }
}
    `;
export const RotateUsersTicketDocument = gql`
    mutation rotateUsersTicket($oldTicket: String!, $newTicket: String!, $newTicketExpiresAt: timestamptz!) {
  updateUsers(_set: {ticket: $newTicket, ticketExpiresAt: $newTicketExpiresAt}, where: {ticket: {_eq: $oldTicket}}) {
    affected_rows
  }
}
    `;
export const ChangeEmailsByTicketDocument = gql`
    mutation changeEmailsByTicket($ticket: String!, $email: citext!, $newTicket: String!, $now: timestamptz!) {
  updateUsers(where: {_and: [{ticket: {_eq: $ticket}}, {ticketExpiresAt: {_gt: $now}}]}, _set: {email: $email, newEmail: null, ticket: $newTicket, ticketExpiresAt: $now}) {
    returning {
      ...userFields
    }
  }
}
    ${UserFieldsFragmentDoc}`;
export const InsertUserDocument = gql`
    mutation insertUser($user: users_insert_input!) {
  insertUser(object: $user) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const DeleteUserDocument = gql`
    mutation deleteUser($userId: uuid!) {
  deleteAuthUserRoles(where: {userId: {_eq: $userId}}) {
    affected_rows
  }
  deleteUser(id: $userId) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const DeanonymizeUserDocument = gql`
    mutation deanonymizeUser($userId: uuid!, $avatarUrl: String, $role: String!) {
  updateAuthUserRoles(where: {user: {id: {_eq: $userId}}}, _set: {role: $role}) {
    affected_rows
  }
  updateUser(pk_columns: {id: $userId}, _set: {avatarUrl: $avatarUrl, defaultRole: $role}) {
    id
  }
}
    `;
export const InsertUserProviderToUserDocument = gql`
    mutation insertUserProviderToUser($userProvider: authUserProviders_insert_input!) {
  insertAuthUserProvider(object: $userProvider) {
    id
  }
}
    `;
export const GetUserByTicketDocument = gql`
    query getUserByTicket($ticket: String!) {
  users(where: {ticket: {_eq: $ticket}}) {
    ...userFields
  }
}
    ${UserFieldsFragmentDoc}`;
export const UpdateUsersByTicketDocument = gql`
    mutation updateUsersByTicket($ticket: String!, $user: users_set_input!) {
  updateUsers(where: {_and: [{ticket: {_eq: $ticket}}, {ticketExpiresAt: {_gt: now}}]}, _set: $user) {
    affected_rows
    returning {
      ...userFields
    }
  }
}
    ${UserFieldsFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    insertProviderRequest(variables: InsertProviderRequestMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<InsertProviderRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InsertProviderRequestMutation>(InsertProviderRequestDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'insertProviderRequest');
    },
    deleteProviderRequest(variables: DeleteProviderRequestMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteProviderRequestMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteProviderRequestMutation>(DeleteProviderRequestDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteProviderRequest');
    },
    providerRequest(variables: ProviderRequestQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<ProviderRequestQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ProviderRequestQuery>(ProviderRequestDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'providerRequest');
    },
    insertRefreshToken(variables: InsertRefreshTokenMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<InsertRefreshTokenMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InsertRefreshTokenMutation>(InsertRefreshTokenDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'insertRefreshToken');
    },
    deleteRefreshToken(variables: DeleteRefreshTokenMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteRefreshTokenMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteRefreshTokenMutation>(DeleteRefreshTokenDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteRefreshToken');
    },
    deleteUserRefreshTokens(variables: DeleteUserRefreshTokensMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteUserRefreshTokensMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserRefreshTokensMutation>(DeleteUserRefreshTokensDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUserRefreshTokens');
    },
    deleteExpiredRefreshTokens(variables?: DeleteExpiredRefreshTokensMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteExpiredRefreshTokensMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteExpiredRefreshTokensMutation>(DeleteExpiredRefreshTokensDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteExpiredRefreshTokens');
    },
    authUserProviders(variables: AuthUserProvidersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<AuthUserProvidersQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<AuthUserProvidersQuery>(AuthUserProvidersDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'authUserProviders');
    },
    userProvider(variables: UserProviderQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UserProviderQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<UserProviderQuery>(UserProviderDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'userProvider');
    },
    updateAuthUserprovider(variables: UpdateAuthUserproviderMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UpdateAuthUserproviderMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateAuthUserproviderMutation>(UpdateAuthUserproviderDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'updateAuthUserprovider');
    },
    insertUserRoles(variables: InsertUserRolesMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<InsertUserRolesMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InsertUserRolesMutation>(InsertUserRolesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'insertUserRoles');
    },
    deleteUserRolesByUserId(variables: DeleteUserRolesByUserIdMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteUserRolesByUserIdMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserRolesByUserIdMutation>(DeleteUserRolesByUserIdDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUserRolesByUserId');
    },
    user(variables: UserQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<UserQuery>(UserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'user');
    },
    users(variables: UsersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UsersQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<UsersQuery>(UsersDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'users');
    },
    getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt(variables: GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtMutation>(GetUsersByRefreshTokenAndUpdateRefreshTokenExpiresAtDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt');
    },
    getUsersByRefreshTokenOld(variables: GetUsersByRefreshTokenOldQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUsersByRefreshTokenOldQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUsersByRefreshTokenOldQuery>(GetUsersByRefreshTokenOldDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUsersByRefreshTokenOld');
    },
    updateUser(variables: UpdateUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UpdateUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateUserMutation>(UpdateUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'updateUser');
    },
    updateUserWhere(variables: UpdateUserWhereMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UpdateUserWhereMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateUserWhereMutation>(UpdateUserWhereDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'updateUserWhere');
    },
    rotateUsersTicket(variables: RotateUsersTicketMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<RotateUsersTicketMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<RotateUsersTicketMutation>(RotateUsersTicketDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'rotateUsersTicket');
    },
    changeEmailsByTicket(variables: ChangeEmailsByTicketMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<ChangeEmailsByTicketMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<ChangeEmailsByTicketMutation>(ChangeEmailsByTicketDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'changeEmailsByTicket');
    },
    insertUser(variables: InsertUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<InsertUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InsertUserMutation>(InsertUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'insertUser');
    },
    deleteUser(variables: DeleteUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserMutation>(DeleteUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUser');
    },
    deanonymizeUser(variables: DeanonymizeUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeanonymizeUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeanonymizeUserMutation>(DeanonymizeUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deanonymizeUser');
    },
    insertUserProviderToUser(variables: InsertUserProviderToUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<InsertUserProviderToUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<InsertUserProviderToUserMutation>(InsertUserProviderToUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'insertUserProviderToUser');
    },
    getUserByTicket(variables: GetUserByTicketQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUserByTicketQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUserByTicketQuery>(GetUserByTicketDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUserByTicket');
    },
    updateUsersByTicket(variables: UpdateUsersByTicketMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<UpdateUsersByTicketMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateUsersByTicketMutation>(UpdateUsersByTicketDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'updateUsersByTicket');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;