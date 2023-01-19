import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Timestamp: any;
  bigint: any;
  bpchar: any;
  bytea: any;
  citext: any;
  jsonb: any;
  smallint: any;
  timestamp: any;
  timestamptz: any;
  uuid: any;
};

export type BackupResult = {
  __typename?: 'BackupResult';
  backupID: Scalars['uuid'];
  size: Scalars['bigint'];
};

export type BackupResultsItem = {
  __typename?: 'BackupResultsItem';
  appID: Scalars['uuid'];
  backupID: Scalars['uuid'];
  error: Scalars['String'];
  size: Scalars['bigint'];
  success: Scalars['Boolean'];
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
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

/** Database Backups */
export type DatabaseBackupEntry = {
  __typename?: 'DatabaseBackupEntry';
  id: Scalars['uuid'];
  size: Scalars['Int'];
};

/** Function Logs */
export type FunctionLogEntry = {
  __typename?: 'FunctionLogEntry';
  createdAt: Scalars['timestamptz'];
  functionPath: Scalars['String'];
  message: Scalars['String'];
};

/** Health */
export type Health = {
  __typename?: 'Health';
  status: Scalars['String'];
  version: Scalars['String'];
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
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

export type Log = {
  __typename?: 'Log';
  log: Scalars['String'];
  service: Scalars['String'];
  timestamp: Scalars['Timestamp'];
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
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

/** columns and relationships of "app_state_history" */
export type AppStateHistory = {
  __typename?: 'appStateHistory';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  /** An object relationship */
  appState: AppStates;
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  message?: Maybe<Scalars['String']>;
  stateId: Scalars['Int'];
};

/** aggregated selection of "app_state_history" */
export type AppStateHistory_Aggregate = {
  __typename?: 'appStateHistory_aggregate';
  aggregate?: Maybe<AppStateHistory_Aggregate_Fields>;
  nodes: Array<AppStateHistory>;
};

export type AppStateHistory_Aggregate_Bool_Exp = {
  count?: InputMaybe<AppStateHistory_Aggregate_Bool_Exp_Count>;
};

export type AppStateHistory_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<AppStateHistory_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "app_state_history" */
export type AppStateHistory_Aggregate_Fields = {
  __typename?: 'appStateHistory_aggregate_fields';
  avg?: Maybe<AppStateHistory_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<AppStateHistory_Max_Fields>;
  min?: Maybe<AppStateHistory_Min_Fields>;
  stddev?: Maybe<AppStateHistory_Stddev_Fields>;
  stddev_pop?: Maybe<AppStateHistory_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<AppStateHistory_Stddev_Samp_Fields>;
  sum?: Maybe<AppStateHistory_Sum_Fields>;
  var_pop?: Maybe<AppStateHistory_Var_Pop_Fields>;
  var_samp?: Maybe<AppStateHistory_Var_Samp_Fields>;
  variance?: Maybe<AppStateHistory_Variance_Fields>;
};


/** aggregate fields of "app_state_history" */
export type AppStateHistory_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "app_state_history" */
export type AppStateHistory_Aggregate_Order_By = {
  avg?: InputMaybe<AppStateHistory_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AppStateHistory_Max_Order_By>;
  min?: InputMaybe<AppStateHistory_Min_Order_By>;
  stddev?: InputMaybe<AppStateHistory_Stddev_Order_By>;
  stddev_pop?: InputMaybe<AppStateHistory_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<AppStateHistory_Stddev_Samp_Order_By>;
  sum?: InputMaybe<AppStateHistory_Sum_Order_By>;
  var_pop?: InputMaybe<AppStateHistory_Var_Pop_Order_By>;
  var_samp?: InputMaybe<AppStateHistory_Var_Samp_Order_By>;
  variance?: InputMaybe<AppStateHistory_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "app_state_history" */
export type AppStateHistory_Arr_Rel_Insert_Input = {
  data: Array<AppStateHistory_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<AppStateHistory_On_Conflict>;
};

/** aggregate avg on columns */
export type AppStateHistory_Avg_Fields = {
  __typename?: 'appStateHistory_avg_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "app_state_history" */
export type AppStateHistory_Avg_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "app_state_history". All fields are combined with a logical 'AND'. */
export type AppStateHistory_Bool_Exp = {
  _and?: InputMaybe<Array<AppStateHistory_Bool_Exp>>;
  _not?: InputMaybe<AppStateHistory_Bool_Exp>;
  _or?: InputMaybe<Array<AppStateHistory_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  appState?: InputMaybe<AppStates_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
  stateId?: InputMaybe<Int_Comparison_Exp>;
};

/** unique or primary key constraints on table "app_state_history" */
export enum AppStateHistory_Constraint {
  /** unique or primary key constraint on columns "id" */
  AppStateHistoryPkey = 'app_state_history_pkey'
}

/** input type for incrementing numeric columns in table "app_state_history" */
export type AppStateHistory_Inc_Input = {
  stateId?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "app_state_history" */
export type AppStateHistory_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  appState?: InputMaybe<AppStates_Obj_Rel_Insert_Input>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
  stateId?: InputMaybe<Scalars['Int']>;
};

/** aggregate max on columns */
export type AppStateHistory_Max_Fields = {
  __typename?: 'appStateHistory_max_fields';
  appId?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  message?: Maybe<Scalars['String']>;
  stateId?: Maybe<Scalars['Int']>;
};

/** order by max() on columns of table "app_state_history" */
export type AppStateHistory_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type AppStateHistory_Min_Fields = {
  __typename?: 'appStateHistory_min_fields';
  appId?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  message?: Maybe<Scalars['String']>;
  stateId?: Maybe<Scalars['Int']>;
};

/** order by min() on columns of table "app_state_history" */
export type AppStateHistory_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "app_state_history" */
export type AppStateHistory_Mutation_Response = {
  __typename?: 'appStateHistory_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AppStateHistory>;
};

/** on_conflict condition type for table "app_state_history" */
export type AppStateHistory_On_Conflict = {
  constraint: AppStateHistory_Constraint;
  update_columns?: Array<AppStateHistory_Update_Column>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};

/** Ordering options when selecting data from "app_state_history". */
export type AppStateHistory_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  appState?: InputMaybe<AppStates_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: app_state_history */
export type AppStateHistory_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "app_state_history" */
export enum AppStateHistory_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  StateId = 'stateId'
}

/** input type for updating data in table "app_state_history" */
export type AppStateHistory_Set_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
  stateId?: InputMaybe<Scalars['Int']>;
};

/** aggregate stddev on columns */
export type AppStateHistory_Stddev_Fields = {
  __typename?: 'appStateHistory_stddev_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type AppStateHistory_Stddev_Pop_Fields = {
  __typename?: 'appStateHistory_stddev_pop_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Pop_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type AppStateHistory_Stddev_Samp_Fields = {
  __typename?: 'appStateHistory_stddev_samp_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Samp_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "appStateHistory" */
export type AppStateHistory_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AppStateHistory_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AppStateHistory_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
  stateId?: InputMaybe<Scalars['Int']>;
};

/** aggregate sum on columns */
export type AppStateHistory_Sum_Fields = {
  __typename?: 'appStateHistory_sum_fields';
  stateId?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "app_state_history" */
export type AppStateHistory_Sum_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** update columns of table "app_state_history" */
export enum AppStateHistory_Update_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  StateId = 'stateId'
}

export type AppStateHistory_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<AppStateHistory_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AppStateHistory_Set_Input>;
  where: AppStateHistory_Bool_Exp;
};

/** aggregate var_pop on columns */
export type AppStateHistory_Var_Pop_Fields = {
  __typename?: 'appStateHistory_var_pop_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "app_state_history" */
export type AppStateHistory_Var_Pop_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type AppStateHistory_Var_Samp_Fields = {
  __typename?: 'appStateHistory_var_samp_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "app_state_history" */
export type AppStateHistory_Var_Samp_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type AppStateHistory_Variance_Fields = {
  __typename?: 'appStateHistory_variance_fields';
  stateId?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "app_state_history" */
export type AppStateHistory_Variance_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** columns and relationships of "app_states" */
export type AppStates = {
  __typename?: 'appStates';
  /** An array relationship */
  appStates: Array<AppStateHistory>;
  /** An aggregate relationship */
  appStates_aggregate: AppStateHistory_Aggregate;
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  id: Scalars['Int'];
  name: Scalars['String'];
};


/** columns and relationships of "app_states" */
export type AppStatesAppStatesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


/** columns and relationships of "app_states" */
export type AppStatesAppStates_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


/** columns and relationships of "app_states" */
export type AppStatesAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "app_states" */
export type AppStatesApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** aggregated selection of "app_states" */
export type AppStates_Aggregate = {
  __typename?: 'appStates_aggregate';
  aggregate?: Maybe<AppStates_Aggregate_Fields>;
  nodes: Array<AppStates>;
};

/** aggregate fields of "app_states" */
export type AppStates_Aggregate_Fields = {
  __typename?: 'appStates_aggregate_fields';
  avg?: Maybe<AppStates_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<AppStates_Max_Fields>;
  min?: Maybe<AppStates_Min_Fields>;
  stddev?: Maybe<AppStates_Stddev_Fields>;
  stddev_pop?: Maybe<AppStates_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<AppStates_Stddev_Samp_Fields>;
  sum?: Maybe<AppStates_Sum_Fields>;
  var_pop?: Maybe<AppStates_Var_Pop_Fields>;
  var_samp?: Maybe<AppStates_Var_Samp_Fields>;
  variance?: Maybe<AppStates_Variance_Fields>;
};


/** aggregate fields of "app_states" */
export type AppStates_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<AppStates_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** aggregate avg on columns */
export type AppStates_Avg_Fields = {
  __typename?: 'appStates_avg_fields';
  id?: Maybe<Scalars['Float']>;
};

/** Boolean expression to filter rows from the table "app_states". All fields are combined with a logical 'AND'. */
export type AppStates_Bool_Exp = {
  _and?: InputMaybe<Array<AppStates_Bool_Exp>>;
  _not?: InputMaybe<AppStates_Bool_Exp>;
  _or?: InputMaybe<Array<AppStates_Bool_Exp>>;
  appStates?: InputMaybe<AppStateHistory_Bool_Exp>;
  appStates_aggregate?: InputMaybe<AppStateHistory_Aggregate_Bool_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "app_states" */
export enum AppStates_Constraint {
  /** unique or primary key constraint on columns "name" */
  AppStatesNameKey = 'app_states_name_key',
  /** unique or primary key constraint on columns "id" */
  AppStatesPkey = 'app_states_pkey'
}

/** input type for incrementing numeric columns in table "app_states" */
export type AppStates_Inc_Input = {
  id?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "app_states" */
export type AppStates_Insert_Input = {
  appStates?: InputMaybe<AppStateHistory_Arr_Rel_Insert_Input>;
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type AppStates_Max_Fields = {
  __typename?: 'appStates_max_fields';
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type AppStates_Min_Fields = {
  __typename?: 'appStates_min_fields';
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "app_states" */
export type AppStates_Mutation_Response = {
  __typename?: 'appStates_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AppStates>;
};

/** input type for inserting object relation for remote table "app_states" */
export type AppStates_Obj_Rel_Insert_Input = {
  data: AppStates_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<AppStates_On_Conflict>;
};

/** on_conflict condition type for table "app_states" */
export type AppStates_On_Conflict = {
  constraint: AppStates_Constraint;
  update_columns?: Array<AppStates_Update_Column>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};

/** Ordering options when selecting data from "app_states". */
export type AppStates_Order_By = {
  appStates_aggregate?: InputMaybe<AppStateHistory_Aggregate_Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
};

/** primary key columns input for table: app_states */
export type AppStates_Pk_Columns_Input = {
  id: Scalars['Int'];
};

/** select columns of table "app_states" */
export enum AppStates_Select_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "app_states" */
export type AppStates_Set_Input = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate stddev on columns */
export type AppStates_Stddev_Fields = {
  __typename?: 'appStates_stddev_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_pop on columns */
export type AppStates_Stddev_Pop_Fields = {
  __typename?: 'appStates_stddev_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_samp on columns */
export type AppStates_Stddev_Samp_Fields = {
  __typename?: 'appStates_stddev_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** Streaming cursor of the table "appStates" */
export type AppStates_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AppStates_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AppStates_Stream_Cursor_Value_Input = {
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate sum on columns */
export type AppStates_Sum_Fields = {
  __typename?: 'appStates_sum_fields';
  id?: Maybe<Scalars['Int']>;
};

/** update columns of table "app_states" */
export enum AppStates_Update_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

export type AppStates_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<AppStates_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AppStates_Set_Input>;
  where: AppStates_Bool_Exp;
};

/** aggregate var_pop on columns */
export type AppStates_Var_Pop_Fields = {
  __typename?: 'appStates_var_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate var_samp on columns */
export type AppStates_Var_Samp_Fields = {
  __typename?: 'appStates_var_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate variance on columns */
export type AppStates_Variance_Fields = {
  __typename?: 'appStates_variance_fields';
  id?: Maybe<Scalars['Float']>;
};

/** columns and relationships of "apps" */
export type Apps = {
  __typename?: 'apps';
  AuthSmtpAuthMethod?: Maybe<Scalars['String']>;
  AuthSmtpSecure?: Maybe<Scalars['Boolean']>;
  S3AccessKey?: Maybe<Scalars['String']>;
  S3Bucket?: Maybe<Scalars['String']>;
  S3Endpoint?: Maybe<Scalars['String']>;
  S3SecretKey?: Maybe<Scalars['String']>;
  S3SslEnabled?: Maybe<Scalars['Boolean']>;
  StorageForceDownloadForContentTypes: Scalars['String'];
  StorageLogLevel: Scalars['String'];
  StorageSwaggerEnabled: Scalars['Boolean'];
  /** An array relationship */
  appStates: Array<AppStateHistory>;
  /** An aggregate relationship */
  appStates_aggregate: AppStateHistory_Aggregate;
  authAccessControlAllowedEmailDomains: Scalars['String'];
  authAccessControlAllowedEmails: Scalars['String'];
  authAccessControlAllowedRedirectUrls: Scalars['String'];
  authAccessControlBlockedEmailDomains: Scalars['String'];
  authAccessControlBlockedEmails: Scalars['String'];
  authAccessTokenExpiresIn: Scalars['Int'];
  authAllowedLocales: Scalars['String'];
  authAnonymousUsersEnabled: Scalars['Boolean'];
  authAppName: Scalars['String'];
  authAppleClientId: Scalars['String'];
  authAppleEnabled: Scalars['Boolean'];
  authAppleKeyId: Scalars['String'];
  authApplePrivateKey: Scalars['String'];
  authAppleScope: Scalars['String'];
  authAppleTeamId: Scalars['String'];
  authClientUrl: Scalars['String'];
  authDisableNewUsers: Scalars['Boolean'];
  authDiscordClientId: Scalars['String'];
  authDiscordClientSecret: Scalars['String'];
  authDiscordEnabled: Scalars['Boolean'];
  authDiscordScope: Scalars['String'];
  authEmailPasswordlessEnabled: Scalars['Boolean'];
  authEmailSigninEmailVerifiedRequired: Scalars['Boolean'];
  authEmailTemplateFetchUrl?: Maybe<Scalars['String']>;
  authEmailsEnabled: Scalars['Boolean'];
  authFacebookClientId: Scalars['String'];
  authFacebookClientSecret: Scalars['String'];
  authFacebookEnabled: Scalars['Boolean'];
  authFacebookProfileFields: Scalars['String'];
  authFacebookScope: Scalars['String'];
  authGithubClientId: Scalars['String'];
  authGithubClientSecret: Scalars['String'];
  authGithubEnabled: Scalars['Boolean'];
  authGithubScope: Scalars['String'];
  authGoogleClientId: Scalars['String'];
  authGoogleClientSecret: Scalars['String'];
  authGoogleEnabled: Scalars['Boolean'];
  authGoogleScope: Scalars['String'];
  authGravatarDefault: Scalars['String'];
  authGravatarEnabled: Scalars['Boolean'];
  authGravatarRating: Scalars['String'];
  authJwtCustomClaims: Scalars['jsonb'];
  authLinkedinClientId: Scalars['String'];
  authLinkedinClientSecret: Scalars['String'];
  authLinkedinEnabled: Scalars['Boolean'];
  authLinkedinScope: Scalars['String'];
  authLocaleDefault: Scalars['String'];
  authLogLevel: Scalars['String'];
  authMfaEnabled: Scalars['Boolean'];
  authMfaTotpIssuer: Scalars['String'];
  authPasswordHibpEnabled: Scalars['Boolean'];
  authPasswordMinLength: Scalars['Int'];
  authRefreshTokenExpiresIn: Scalars['Int'];
  authSmsPasswordlessEnabled: Scalars['Boolean'];
  authSmsTwilioAccountSid: Scalars['String'];
  authSmsTwilioAuthToken: Scalars['String'];
  authSmsTwilioFrom: Scalars['String'];
  authSmsTwilioMessagingServiceId: Scalars['String'];
  authSmtpHost?: Maybe<Scalars['String']>;
  authSmtpPass?: Maybe<Scalars['String']>;
  authSmtpPort?: Maybe<Scalars['Int']>;
  authSmtpSender?: Maybe<Scalars['String']>;
  authSmtpUser?: Maybe<Scalars['String']>;
  authSpotifyClientId: Scalars['String'];
  authSpotifyClientSecret: Scalars['String'];
  authSpotifyEnabled: Scalars['Boolean'];
  authSpotifyScope: Scalars['String'];
  authTwitchClientId: Scalars['String'];
  authTwitchClientSecret: Scalars['String'];
  authTwitchEnabled: Scalars['Boolean'];
  authTwitchScope: Scalars['String'];
  authTwitterConsumerKey: Scalars['String'];
  authTwitterConsumerSecret: Scalars['String'];
  authTwitterEnabled: Scalars['Boolean'];
  authUserDefaultAllowedRoles: Scalars['String'];
  authUserDefaultRole: Scalars['String'];
  authUserSessionVariableFields: Scalars['String'];
  authWebAuthnEnabled: Scalars['Boolean'];
  authWindowsLiveClientId: Scalars['String'];
  authWindowsLiveClientSecret: Scalars['String'];
  authWindowsLiveEnabled: Scalars['Boolean'];
  authWindowsLiveScope: Scalars['String'];
  authWorkOsClientId: Scalars['String'];
  authWorkOsClientSecret: Scalars['String'];
  authWorkOsDefaultConnection: Scalars['String'];
  authWorkOsDefaultDomain: Scalars['String'];
  authWorkOsDefaultOrganization: Scalars['String'];
  authWorkOsEnabled: Scalars['Boolean'];
  autoUpdate: Scalars['Boolean'];
  /** An array relationship */
  backups: Array<Backups>;
  /** An aggregate relationship */
  backups_aggregate: Backups_Aggregate;
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  creator?: Maybe<Users>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  /** An array relationship */
  deployments: Array<Deployments>;
  /** An aggregate relationship */
  deployments_aggregate: Deployments_Aggregate;
  /** An object relationship */
  desiredAppState: AppStates;
  desiredState: Scalars['Int'];
  emailTemplatesS3Key: Scalars['String'];
  /** An array relationship */
  environmentVariables: Array<EnvironmentVariables>;
  /** An aggregate relationship */
  environmentVariables_aggregate: EnvironmentVariables_Aggregate;
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** An aggregate relationship */
  featureFlags_aggregate: FeatureFlags_Aggregate;
  /** An object relationship */
  githubRepository?: Maybe<GithubRepositories>;
  githubRepositoryId?: Maybe<Scalars['uuid']>;
  hasuraAuthVersion: Scalars['String'];
  hasuraGraphqlAdminSecret: Scalars['String'];
  hasuraGraphqlDatabaseUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlEnableConsole: Scalars['Boolean'];
  hasuraGraphqlEnableRemoteSchemaPermissions: Scalars['Boolean'];
  hasuraGraphqlEnabledApis: Scalars['String'];
  hasuraGraphqlGraphqlUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlJwtSecret: Scalars['String'];
  hasuraStorageVersion: Scalars['String'];
  hasuraVersion: Scalars['String'];
  id: Scalars['uuid'];
  isProvisioned: Scalars['Boolean'];
  metadataFunctions: Scalars['jsonb'];
  name: Scalars['String'];
  nhostBaseFolder: Scalars['String'];
  /** whether or not this app is paused */
  paused: Scalars['Boolean'];
  /** An object relationship */
  plan: Plans;
  planId: Scalars['uuid'];
  postgresDatabase?: Maybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: Maybe<Scalars['String']>;
  postgresPassword: Scalars['String'];
  postgresPublicAccess: Scalars['Boolean'];
  postgresSchemaMigrationPassword?: Maybe<Scalars['String']>;
  postgresSchemaMigrationUser?: Maybe<Scalars['String']>;
  postgresUser?: Maybe<Scalars['String']>;
  postgresVersion: Scalars['String'];
  providersUpdated?: Maybe<Scalars['Boolean']>;
  /** An object relationship */
  region: Regions;
  regionId: Scalars['uuid'];
  repositoryProductionBranch: Scalars['String'];
  slug: Scalars['String'];
  stripeSubscriptionId?: Maybe<Scalars['String']>;
  subdomain: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  webhookSecret: Scalars['String'];
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};


/** columns and relationships of "apps" */
export type AppsAppStatesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsAppStates_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsAuthJwtCustomClaimsArgs = {
  path?: InputMaybe<Scalars['String']>;
};


/** columns and relationships of "apps" */
export type AppsBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsBackups_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsDeployments_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsEnvironmentVariablesArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsEnvironmentVariables_AggregateArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsFeatureFlags_AggregateArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsMetadataFunctionsArgs = {
  path?: InputMaybe<Scalars['String']>;
};

/** aggregated selection of "apps" */
export type Apps_Aggregate = {
  __typename?: 'apps_aggregate';
  aggregate?: Maybe<Apps_Aggregate_Fields>;
  nodes: Array<Apps>;
};

export type Apps_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Apps_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Apps_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Apps_Aggregate_Bool_Exp_Count>;
};

export type Apps_Aggregate_Bool_Exp_Bool_And = {
  arguments: Apps_Select_Column_Apps_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Apps_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Apps_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Apps_Select_Column_Apps_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Apps_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Apps_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Apps_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Apps_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "apps" */
export type Apps_Aggregate_Fields = {
  __typename?: 'apps_aggregate_fields';
  avg?: Maybe<Apps_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Apps_Max_Fields>;
  min?: Maybe<Apps_Min_Fields>;
  stddev?: Maybe<Apps_Stddev_Fields>;
  stddev_pop?: Maybe<Apps_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Apps_Stddev_Samp_Fields>;
  sum?: Maybe<Apps_Sum_Fields>;
  var_pop?: Maybe<Apps_Var_Pop_Fields>;
  var_samp?: Maybe<Apps_Var_Samp_Fields>;
  variance?: Maybe<Apps_Variance_Fields>;
};


/** aggregate fields of "apps" */
export type Apps_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Apps_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "apps" */
export type Apps_Aggregate_Order_By = {
  avg?: InputMaybe<Apps_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Apps_Max_Order_By>;
  min?: InputMaybe<Apps_Min_Order_By>;
  stddev?: InputMaybe<Apps_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Apps_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Apps_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Apps_Sum_Order_By>;
  var_pop?: InputMaybe<Apps_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Apps_Var_Samp_Order_By>;
  variance?: InputMaybe<Apps_Variance_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Apps_Append_Input = {
  authJwtCustomClaims?: InputMaybe<Scalars['jsonb']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
};

/** input type for inserting array relation for remote table "apps" */
export type Apps_Arr_Rel_Insert_Input = {
  data: Array<Apps_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};

/** aggregate avg on columns */
export type Apps_Avg_Fields = {
  __typename?: 'apps_avg_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "apps" */
export type Apps_Avg_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "apps". All fields are combined with a logical 'AND'. */
export type Apps_Bool_Exp = {
  AuthSmtpAuthMethod?: InputMaybe<String_Comparison_Exp>;
  AuthSmtpSecure?: InputMaybe<Boolean_Comparison_Exp>;
  S3AccessKey?: InputMaybe<String_Comparison_Exp>;
  S3Bucket?: InputMaybe<String_Comparison_Exp>;
  S3Endpoint?: InputMaybe<String_Comparison_Exp>;
  S3SecretKey?: InputMaybe<String_Comparison_Exp>;
  S3SslEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  StorageForceDownloadForContentTypes?: InputMaybe<String_Comparison_Exp>;
  StorageLogLevel?: InputMaybe<String_Comparison_Exp>;
  StorageSwaggerEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  _and?: InputMaybe<Array<Apps_Bool_Exp>>;
  _not?: InputMaybe<Apps_Bool_Exp>;
  _or?: InputMaybe<Array<Apps_Bool_Exp>>;
  appStates?: InputMaybe<AppStateHistory_Bool_Exp>;
  appStates_aggregate?: InputMaybe<AppStateHistory_Aggregate_Bool_Exp>;
  authAccessControlAllowedEmailDomains?: InputMaybe<String_Comparison_Exp>;
  authAccessControlAllowedEmails?: InputMaybe<String_Comparison_Exp>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<String_Comparison_Exp>;
  authAccessControlBlockedEmailDomains?: InputMaybe<String_Comparison_Exp>;
  authAccessControlBlockedEmails?: InputMaybe<String_Comparison_Exp>;
  authAccessTokenExpiresIn?: InputMaybe<Int_Comparison_Exp>;
  authAllowedLocales?: InputMaybe<String_Comparison_Exp>;
  authAnonymousUsersEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authAppName?: InputMaybe<String_Comparison_Exp>;
  authAppleClientId?: InputMaybe<String_Comparison_Exp>;
  authAppleEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authAppleKeyId?: InputMaybe<String_Comparison_Exp>;
  authApplePrivateKey?: InputMaybe<String_Comparison_Exp>;
  authAppleScope?: InputMaybe<String_Comparison_Exp>;
  authAppleTeamId?: InputMaybe<String_Comparison_Exp>;
  authClientUrl?: InputMaybe<String_Comparison_Exp>;
  authDisableNewUsers?: InputMaybe<Boolean_Comparison_Exp>;
  authDiscordClientId?: InputMaybe<String_Comparison_Exp>;
  authDiscordClientSecret?: InputMaybe<String_Comparison_Exp>;
  authDiscordEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authDiscordScope?: InputMaybe<String_Comparison_Exp>;
  authEmailPasswordlessEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authEmailSigninEmailVerifiedRequired?: InputMaybe<Boolean_Comparison_Exp>;
  authEmailTemplateFetchUrl?: InputMaybe<String_Comparison_Exp>;
  authEmailsEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authFacebookClientId?: InputMaybe<String_Comparison_Exp>;
  authFacebookClientSecret?: InputMaybe<String_Comparison_Exp>;
  authFacebookEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authFacebookProfileFields?: InputMaybe<String_Comparison_Exp>;
  authFacebookScope?: InputMaybe<String_Comparison_Exp>;
  authGithubClientId?: InputMaybe<String_Comparison_Exp>;
  authGithubClientSecret?: InputMaybe<String_Comparison_Exp>;
  authGithubEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authGithubScope?: InputMaybe<String_Comparison_Exp>;
  authGoogleClientId?: InputMaybe<String_Comparison_Exp>;
  authGoogleClientSecret?: InputMaybe<String_Comparison_Exp>;
  authGoogleEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authGoogleScope?: InputMaybe<String_Comparison_Exp>;
  authGravatarDefault?: InputMaybe<String_Comparison_Exp>;
  authGravatarEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authGravatarRating?: InputMaybe<String_Comparison_Exp>;
  authJwtCustomClaims?: InputMaybe<Jsonb_Comparison_Exp>;
  authLinkedinClientId?: InputMaybe<String_Comparison_Exp>;
  authLinkedinClientSecret?: InputMaybe<String_Comparison_Exp>;
  authLinkedinEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authLinkedinScope?: InputMaybe<String_Comparison_Exp>;
  authLocaleDefault?: InputMaybe<String_Comparison_Exp>;
  authLogLevel?: InputMaybe<String_Comparison_Exp>;
  authMfaEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authMfaTotpIssuer?: InputMaybe<String_Comparison_Exp>;
  authPasswordHibpEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authPasswordMinLength?: InputMaybe<Int_Comparison_Exp>;
  authRefreshTokenExpiresIn?: InputMaybe<Int_Comparison_Exp>;
  authSmsPasswordlessEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authSmsTwilioAccountSid?: InputMaybe<String_Comparison_Exp>;
  authSmsTwilioAuthToken?: InputMaybe<String_Comparison_Exp>;
  authSmsTwilioFrom?: InputMaybe<String_Comparison_Exp>;
  authSmsTwilioMessagingServiceId?: InputMaybe<String_Comparison_Exp>;
  authSmtpHost?: InputMaybe<String_Comparison_Exp>;
  authSmtpPass?: InputMaybe<String_Comparison_Exp>;
  authSmtpPort?: InputMaybe<Int_Comparison_Exp>;
  authSmtpSender?: InputMaybe<String_Comparison_Exp>;
  authSmtpUser?: InputMaybe<String_Comparison_Exp>;
  authSpotifyClientId?: InputMaybe<String_Comparison_Exp>;
  authSpotifyClientSecret?: InputMaybe<String_Comparison_Exp>;
  authSpotifyEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authSpotifyScope?: InputMaybe<String_Comparison_Exp>;
  authTwitchClientId?: InputMaybe<String_Comparison_Exp>;
  authTwitchClientSecret?: InputMaybe<String_Comparison_Exp>;
  authTwitchEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authTwitchScope?: InputMaybe<String_Comparison_Exp>;
  authTwitterConsumerKey?: InputMaybe<String_Comparison_Exp>;
  authTwitterConsumerSecret?: InputMaybe<String_Comparison_Exp>;
  authTwitterEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authUserDefaultAllowedRoles?: InputMaybe<String_Comparison_Exp>;
  authUserDefaultRole?: InputMaybe<String_Comparison_Exp>;
  authUserSessionVariableFields?: InputMaybe<String_Comparison_Exp>;
  authWebAuthnEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authWindowsLiveClientId?: InputMaybe<String_Comparison_Exp>;
  authWindowsLiveClientSecret?: InputMaybe<String_Comparison_Exp>;
  authWindowsLiveEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  authWindowsLiveScope?: InputMaybe<String_Comparison_Exp>;
  authWorkOsClientId?: InputMaybe<String_Comparison_Exp>;
  authWorkOsClientSecret?: InputMaybe<String_Comparison_Exp>;
  authWorkOsDefaultConnection?: InputMaybe<String_Comparison_Exp>;
  authWorkOsDefaultDomain?: InputMaybe<String_Comparison_Exp>;
  authWorkOsDefaultOrganization?: InputMaybe<String_Comparison_Exp>;
  authWorkOsEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  autoUpdate?: InputMaybe<Boolean_Comparison_Exp>;
  backups?: InputMaybe<Backups_Bool_Exp>;
  backups_aggregate?: InputMaybe<Backups_Aggregate_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creator?: InputMaybe<Users_Bool_Exp>;
  creatorUserId?: InputMaybe<Uuid_Comparison_Exp>;
  deployments?: InputMaybe<Deployments_Bool_Exp>;
  deployments_aggregate?: InputMaybe<Deployments_Aggregate_Bool_Exp>;
  desiredAppState?: InputMaybe<AppStates_Bool_Exp>;
  desiredState?: InputMaybe<Int_Comparison_Exp>;
  emailTemplatesS3Key?: InputMaybe<String_Comparison_Exp>;
  environmentVariables?: InputMaybe<EnvironmentVariables_Bool_Exp>;
  environmentVariables_aggregate?: InputMaybe<EnvironmentVariables_Aggregate_Bool_Exp>;
  featureFlags?: InputMaybe<FeatureFlags_Bool_Exp>;
  featureFlags_aggregate?: InputMaybe<FeatureFlags_Aggregate_Bool_Exp>;
  githubRepository?: InputMaybe<GithubRepositories_Bool_Exp>;
  githubRepositoryId?: InputMaybe<Uuid_Comparison_Exp>;
  hasuraAuthVersion?: InputMaybe<String_Comparison_Exp>;
  hasuraGraphqlAdminSecret?: InputMaybe<String_Comparison_Exp>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<String_Comparison_Exp>;
  hasuraGraphqlEnableConsole?: InputMaybe<Boolean_Comparison_Exp>;
  hasuraGraphqlEnableRemoteSchemaPermissions?: InputMaybe<Boolean_Comparison_Exp>;
  hasuraGraphqlEnabledApis?: InputMaybe<String_Comparison_Exp>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<String_Comparison_Exp>;
  hasuraGraphqlJwtSecret?: InputMaybe<String_Comparison_Exp>;
  hasuraStorageVersion?: InputMaybe<String_Comparison_Exp>;
  hasuraVersion?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isProvisioned?: InputMaybe<Boolean_Comparison_Exp>;
  metadataFunctions?: InputMaybe<Jsonb_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nhostBaseFolder?: InputMaybe<String_Comparison_Exp>;
  paused?: InputMaybe<Boolean_Comparison_Exp>;
  plan?: InputMaybe<Plans_Bool_Exp>;
  planId?: InputMaybe<Uuid_Comparison_Exp>;
  postgresDatabase?: InputMaybe<String_Comparison_Exp>;
  postgresHost?: InputMaybe<String_Comparison_Exp>;
  postgresPassword?: InputMaybe<String_Comparison_Exp>;
  postgresPublicAccess?: InputMaybe<Boolean_Comparison_Exp>;
  postgresSchemaMigrationPassword?: InputMaybe<String_Comparison_Exp>;
  postgresSchemaMigrationUser?: InputMaybe<String_Comparison_Exp>;
  postgresUser?: InputMaybe<String_Comparison_Exp>;
  postgresVersion?: InputMaybe<String_Comparison_Exp>;
  providersUpdated?: InputMaybe<Boolean_Comparison_Exp>;
  region?: InputMaybe<Regions_Bool_Exp>;
  regionId?: InputMaybe<Uuid_Comparison_Exp>;
  repositoryProductionBranch?: InputMaybe<String_Comparison_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  stripeSubscriptionId?: InputMaybe<String_Comparison_Exp>;
  subdomain?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  webhookSecret?: InputMaybe<String_Comparison_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "apps" */
export enum Apps_Constraint {
  /** unique or primary key constraint on columns "id" */
  AppsPkey = 'apps_pkey',
  /** unique or primary key constraint on columns "subdomain" */
  AppsSubdomainKey = 'apps_subdomain_key',
  /** unique or primary key constraint on columns "workspace_id", "slug" */
  AppsWorkspaceIdSlugKey = 'apps_workspace_id_slug_key'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Apps_Delete_At_Path_Input = {
  authJwtCustomClaims?: InputMaybe<Array<Scalars['String']>>;
  metadataFunctions?: InputMaybe<Array<Scalars['String']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Apps_Delete_Elem_Input = {
  authJwtCustomClaims?: InputMaybe<Scalars['Int']>;
  metadataFunctions?: InputMaybe<Scalars['Int']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Apps_Delete_Key_Input = {
  authJwtCustomClaims?: InputMaybe<Scalars['String']>;
  metadataFunctions?: InputMaybe<Scalars['String']>;
};

/** input type for incrementing numeric columns in table "apps" */
export type Apps_Inc_Input = {
  authAccessTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authPasswordMinLength?: InputMaybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authSmtpPort?: InputMaybe<Scalars['Int']>;
  desiredState?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "apps" */
export type Apps_Insert_Input = {
  AuthSmtpAuthMethod?: InputMaybe<Scalars['String']>;
  AuthSmtpSecure?: InputMaybe<Scalars['Boolean']>;
  S3AccessKey?: InputMaybe<Scalars['String']>;
  S3Bucket?: InputMaybe<Scalars['String']>;
  S3Endpoint?: InputMaybe<Scalars['String']>;
  S3SecretKey?: InputMaybe<Scalars['String']>;
  S3SslEnabled?: InputMaybe<Scalars['Boolean']>;
  StorageForceDownloadForContentTypes?: InputMaybe<Scalars['String']>;
  StorageLogLevel?: InputMaybe<Scalars['String']>;
  StorageSwaggerEnabled?: InputMaybe<Scalars['Boolean']>;
  appStates?: InputMaybe<AppStateHistory_Arr_Rel_Insert_Input>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedEmails?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmails?: InputMaybe<Scalars['String']>;
  authAccessTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authAllowedLocales?: InputMaybe<Scalars['String']>;
  authAnonymousUsersEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppName?: InputMaybe<Scalars['String']>;
  authAppleClientId?: InputMaybe<Scalars['String']>;
  authAppleEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppleKeyId?: InputMaybe<Scalars['String']>;
  authApplePrivateKey?: InputMaybe<Scalars['String']>;
  authAppleScope?: InputMaybe<Scalars['String']>;
  authAppleTeamId?: InputMaybe<Scalars['String']>;
  authClientUrl?: InputMaybe<Scalars['String']>;
  authDisableNewUsers?: InputMaybe<Scalars['Boolean']>;
  authDiscordClientId?: InputMaybe<Scalars['String']>;
  authDiscordClientSecret?: InputMaybe<Scalars['String']>;
  authDiscordEnabled?: InputMaybe<Scalars['Boolean']>;
  authDiscordScope?: InputMaybe<Scalars['String']>;
  authEmailPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authEmailSigninEmailVerifiedRequired?: InputMaybe<Scalars['Boolean']>;
  authEmailTemplateFetchUrl?: InputMaybe<Scalars['String']>;
  authEmailsEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookClientId?: InputMaybe<Scalars['String']>;
  authFacebookClientSecret?: InputMaybe<Scalars['String']>;
  authFacebookEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookProfileFields?: InputMaybe<Scalars['String']>;
  authFacebookScope?: InputMaybe<Scalars['String']>;
  authGithubClientId?: InputMaybe<Scalars['String']>;
  authGithubClientSecret?: InputMaybe<Scalars['String']>;
  authGithubEnabled?: InputMaybe<Scalars['Boolean']>;
  authGithubScope?: InputMaybe<Scalars['String']>;
  authGoogleClientId?: InputMaybe<Scalars['String']>;
  authGoogleClientSecret?: InputMaybe<Scalars['String']>;
  authGoogleEnabled?: InputMaybe<Scalars['Boolean']>;
  authGoogleScope?: InputMaybe<Scalars['String']>;
  authGravatarDefault?: InputMaybe<Scalars['String']>;
  authGravatarEnabled?: InputMaybe<Scalars['Boolean']>;
  authGravatarRating?: InputMaybe<Scalars['String']>;
  authJwtCustomClaims?: InputMaybe<Scalars['jsonb']>;
  authLinkedinClientId?: InputMaybe<Scalars['String']>;
  authLinkedinClientSecret?: InputMaybe<Scalars['String']>;
  authLinkedinEnabled?: InputMaybe<Scalars['Boolean']>;
  authLinkedinScope?: InputMaybe<Scalars['String']>;
  authLocaleDefault?: InputMaybe<Scalars['String']>;
  authLogLevel?: InputMaybe<Scalars['String']>;
  authMfaEnabled?: InputMaybe<Scalars['Boolean']>;
  authMfaTotpIssuer?: InputMaybe<Scalars['String']>;
  authPasswordHibpEnabled?: InputMaybe<Scalars['Boolean']>;
  authPasswordMinLength?: InputMaybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authSmsPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authSmsTwilioAccountSid?: InputMaybe<Scalars['String']>;
  authSmsTwilioAuthToken?: InputMaybe<Scalars['String']>;
  authSmsTwilioFrom?: InputMaybe<Scalars['String']>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Scalars['String']>;
  authSmtpHost?: InputMaybe<Scalars['String']>;
  authSmtpPass?: InputMaybe<Scalars['String']>;
  authSmtpPort?: InputMaybe<Scalars['Int']>;
  authSmtpSender?: InputMaybe<Scalars['String']>;
  authSmtpUser?: InputMaybe<Scalars['String']>;
  authSpotifyClientId?: InputMaybe<Scalars['String']>;
  authSpotifyClientSecret?: InputMaybe<Scalars['String']>;
  authSpotifyEnabled?: InputMaybe<Scalars['Boolean']>;
  authSpotifyScope?: InputMaybe<Scalars['String']>;
  authTwitchClientId?: InputMaybe<Scalars['String']>;
  authTwitchClientSecret?: InputMaybe<Scalars['String']>;
  authTwitchEnabled?: InputMaybe<Scalars['Boolean']>;
  authTwitchScope?: InputMaybe<Scalars['String']>;
  authTwitterConsumerKey?: InputMaybe<Scalars['String']>;
  authTwitterConsumerSecret?: InputMaybe<Scalars['String']>;
  authTwitterEnabled?: InputMaybe<Scalars['Boolean']>;
  authUserDefaultAllowedRoles?: InputMaybe<Scalars['String']>;
  authUserDefaultRole?: InputMaybe<Scalars['String']>;
  authUserSessionVariableFields?: InputMaybe<Scalars['String']>;
  authWebAuthnEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveClientId?: InputMaybe<Scalars['String']>;
  authWindowsLiveClientSecret?: InputMaybe<Scalars['String']>;
  authWindowsLiveEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveScope?: InputMaybe<Scalars['String']>;
  authWorkOsClientId?: InputMaybe<Scalars['String']>;
  authWorkOsClientSecret?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultConnection?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultDomain?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultOrganization?: InputMaybe<Scalars['String']>;
  authWorkOsEnabled?: InputMaybe<Scalars['Boolean']>;
  autoUpdate?: InputMaybe<Scalars['Boolean']>;
  backups?: InputMaybe<Backups_Arr_Rel_Insert_Input>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creator?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  deployments?: InputMaybe<Deployments_Arr_Rel_Insert_Input>;
  desiredAppState?: InputMaybe<AppStates_Obj_Rel_Insert_Input>;
  desiredState?: InputMaybe<Scalars['Int']>;
  emailTemplatesS3Key?: InputMaybe<Scalars['String']>;
  environmentVariables?: InputMaybe<EnvironmentVariables_Arr_Rel_Insert_Input>;
  featureFlags?: InputMaybe<FeatureFlags_Arr_Rel_Insert_Input>;
  githubRepository?: InputMaybe<GithubRepositories_Obj_Rel_Insert_Input>;
  githubRepositoryId?: InputMaybe<Scalars['uuid']>;
  hasuraAuthVersion?: InputMaybe<Scalars['String']>;
  hasuraGraphqlAdminSecret?: InputMaybe<Scalars['String']>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlEnableConsole?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnableRemoteSchemaPermissions?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnabledApis?: InputMaybe<Scalars['String']>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlJwtSecret?: InputMaybe<Scalars['String']>;
  hasuraStorageVersion?: InputMaybe<Scalars['String']>;
  hasuraVersion?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isProvisioned?: InputMaybe<Scalars['Boolean']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
  name?: InputMaybe<Scalars['String']>;
  nhostBaseFolder?: InputMaybe<Scalars['String']>;
  /** whether or not this app is paused */
  paused?: InputMaybe<Scalars['Boolean']>;
  plan?: InputMaybe<Plans_Obj_Rel_Insert_Input>;
  planId?: InputMaybe<Scalars['uuid']>;
  postgresDatabase?: InputMaybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: InputMaybe<Scalars['String']>;
  postgresPassword?: InputMaybe<Scalars['String']>;
  postgresPublicAccess?: InputMaybe<Scalars['Boolean']>;
  postgresSchemaMigrationPassword?: InputMaybe<Scalars['String']>;
  postgresSchemaMigrationUser?: InputMaybe<Scalars['String']>;
  postgresUser?: InputMaybe<Scalars['String']>;
  postgresVersion?: InputMaybe<Scalars['String']>;
  providersUpdated?: InputMaybe<Scalars['Boolean']>;
  region?: InputMaybe<Regions_Obj_Rel_Insert_Input>;
  regionId?: InputMaybe<Scalars['uuid']>;
  repositoryProductionBranch?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  stripeSubscriptionId?: InputMaybe<Scalars['String']>;
  subdomain?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  webhookSecret?: InputMaybe<Scalars['String']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type Apps_Max_Fields = {
  __typename?: 'apps_max_fields';
  AuthSmtpAuthMethod?: Maybe<Scalars['String']>;
  S3AccessKey?: Maybe<Scalars['String']>;
  S3Bucket?: Maybe<Scalars['String']>;
  S3Endpoint?: Maybe<Scalars['String']>;
  S3SecretKey?: Maybe<Scalars['String']>;
  StorageForceDownloadForContentTypes?: Maybe<Scalars['String']>;
  StorageLogLevel?: Maybe<Scalars['String']>;
  authAccessControlAllowedEmailDomains?: Maybe<Scalars['String']>;
  authAccessControlAllowedEmails?: Maybe<Scalars['String']>;
  authAccessControlAllowedRedirectUrls?: Maybe<Scalars['String']>;
  authAccessControlBlockedEmailDomains?: Maybe<Scalars['String']>;
  authAccessControlBlockedEmails?: Maybe<Scalars['String']>;
  authAccessTokenExpiresIn?: Maybe<Scalars['Int']>;
  authAllowedLocales?: Maybe<Scalars['String']>;
  authAppName?: Maybe<Scalars['String']>;
  authAppleClientId?: Maybe<Scalars['String']>;
  authAppleKeyId?: Maybe<Scalars['String']>;
  authApplePrivateKey?: Maybe<Scalars['String']>;
  authAppleScope?: Maybe<Scalars['String']>;
  authAppleTeamId?: Maybe<Scalars['String']>;
  authClientUrl?: Maybe<Scalars['String']>;
  authDiscordClientId?: Maybe<Scalars['String']>;
  authDiscordClientSecret?: Maybe<Scalars['String']>;
  authDiscordScope?: Maybe<Scalars['String']>;
  authEmailTemplateFetchUrl?: Maybe<Scalars['String']>;
  authFacebookClientId?: Maybe<Scalars['String']>;
  authFacebookClientSecret?: Maybe<Scalars['String']>;
  authFacebookProfileFields?: Maybe<Scalars['String']>;
  authFacebookScope?: Maybe<Scalars['String']>;
  authGithubClientId?: Maybe<Scalars['String']>;
  authGithubClientSecret?: Maybe<Scalars['String']>;
  authGithubScope?: Maybe<Scalars['String']>;
  authGoogleClientId?: Maybe<Scalars['String']>;
  authGoogleClientSecret?: Maybe<Scalars['String']>;
  authGoogleScope?: Maybe<Scalars['String']>;
  authGravatarDefault?: Maybe<Scalars['String']>;
  authGravatarRating?: Maybe<Scalars['String']>;
  authLinkedinClientId?: Maybe<Scalars['String']>;
  authLinkedinClientSecret?: Maybe<Scalars['String']>;
  authLinkedinScope?: Maybe<Scalars['String']>;
  authLocaleDefault?: Maybe<Scalars['String']>;
  authLogLevel?: Maybe<Scalars['String']>;
  authMfaTotpIssuer?: Maybe<Scalars['String']>;
  authPasswordMinLength?: Maybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Int']>;
  authSmsTwilioAccountSid?: Maybe<Scalars['String']>;
  authSmsTwilioAuthToken?: Maybe<Scalars['String']>;
  authSmsTwilioFrom?: Maybe<Scalars['String']>;
  authSmsTwilioMessagingServiceId?: Maybe<Scalars['String']>;
  authSmtpHost?: Maybe<Scalars['String']>;
  authSmtpPass?: Maybe<Scalars['String']>;
  authSmtpPort?: Maybe<Scalars['Int']>;
  authSmtpSender?: Maybe<Scalars['String']>;
  authSmtpUser?: Maybe<Scalars['String']>;
  authSpotifyClientId?: Maybe<Scalars['String']>;
  authSpotifyClientSecret?: Maybe<Scalars['String']>;
  authSpotifyScope?: Maybe<Scalars['String']>;
  authTwitchClientId?: Maybe<Scalars['String']>;
  authTwitchClientSecret?: Maybe<Scalars['String']>;
  authTwitchScope?: Maybe<Scalars['String']>;
  authTwitterConsumerKey?: Maybe<Scalars['String']>;
  authTwitterConsumerSecret?: Maybe<Scalars['String']>;
  authUserDefaultAllowedRoles?: Maybe<Scalars['String']>;
  authUserDefaultRole?: Maybe<Scalars['String']>;
  authUserSessionVariableFields?: Maybe<Scalars['String']>;
  authWindowsLiveClientId?: Maybe<Scalars['String']>;
  authWindowsLiveClientSecret?: Maybe<Scalars['String']>;
  authWindowsLiveScope?: Maybe<Scalars['String']>;
  authWorkOsClientId?: Maybe<Scalars['String']>;
  authWorkOsClientSecret?: Maybe<Scalars['String']>;
  authWorkOsDefaultConnection?: Maybe<Scalars['String']>;
  authWorkOsDefaultDomain?: Maybe<Scalars['String']>;
  authWorkOsDefaultOrganization?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  desiredState?: Maybe<Scalars['Int']>;
  emailTemplatesS3Key?: Maybe<Scalars['String']>;
  githubRepositoryId?: Maybe<Scalars['uuid']>;
  hasuraAuthVersion?: Maybe<Scalars['String']>;
  hasuraGraphqlAdminSecret?: Maybe<Scalars['String']>;
  hasuraGraphqlDatabaseUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlEnabledApis?: Maybe<Scalars['String']>;
  hasuraGraphqlGraphqlUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlJwtSecret?: Maybe<Scalars['String']>;
  hasuraStorageVersion?: Maybe<Scalars['String']>;
  hasuraVersion?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  nhostBaseFolder?: Maybe<Scalars['String']>;
  planId?: Maybe<Scalars['uuid']>;
  postgresDatabase?: Maybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: Maybe<Scalars['String']>;
  postgresPassword?: Maybe<Scalars['String']>;
  postgresSchemaMigrationPassword?: Maybe<Scalars['String']>;
  postgresSchemaMigrationUser?: Maybe<Scalars['String']>;
  postgresUser?: Maybe<Scalars['String']>;
  postgresVersion?: Maybe<Scalars['String']>;
  regionId?: Maybe<Scalars['uuid']>;
  repositoryProductionBranch?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  stripeSubscriptionId?: Maybe<Scalars['String']>;
  subdomain?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  webhookSecret?: Maybe<Scalars['String']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "apps" */
export type Apps_Max_Order_By = {
  AuthSmtpAuthMethod?: InputMaybe<Order_By>;
  S3AccessKey?: InputMaybe<Order_By>;
  S3Bucket?: InputMaybe<Order_By>;
  S3Endpoint?: InputMaybe<Order_By>;
  S3SecretKey?: InputMaybe<Order_By>;
  StorageForceDownloadForContentTypes?: InputMaybe<Order_By>;
  StorageLogLevel?: InputMaybe<Order_By>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlAllowedEmails?: InputMaybe<Order_By>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Order_By>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlBlockedEmails?: InputMaybe<Order_By>;
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authAllowedLocales?: InputMaybe<Order_By>;
  authAppName?: InputMaybe<Order_By>;
  authAppleClientId?: InputMaybe<Order_By>;
  authAppleKeyId?: InputMaybe<Order_By>;
  authApplePrivateKey?: InputMaybe<Order_By>;
  authAppleScope?: InputMaybe<Order_By>;
  authAppleTeamId?: InputMaybe<Order_By>;
  authClientUrl?: InputMaybe<Order_By>;
  authDiscordClientId?: InputMaybe<Order_By>;
  authDiscordClientSecret?: InputMaybe<Order_By>;
  authDiscordScope?: InputMaybe<Order_By>;
  authEmailTemplateFetchUrl?: InputMaybe<Order_By>;
  authFacebookClientId?: InputMaybe<Order_By>;
  authFacebookClientSecret?: InputMaybe<Order_By>;
  authFacebookProfileFields?: InputMaybe<Order_By>;
  authFacebookScope?: InputMaybe<Order_By>;
  authGithubClientId?: InputMaybe<Order_By>;
  authGithubClientSecret?: InputMaybe<Order_By>;
  authGithubScope?: InputMaybe<Order_By>;
  authGoogleClientId?: InputMaybe<Order_By>;
  authGoogleClientSecret?: InputMaybe<Order_By>;
  authGoogleScope?: InputMaybe<Order_By>;
  authGravatarDefault?: InputMaybe<Order_By>;
  authGravatarRating?: InputMaybe<Order_By>;
  authLinkedinClientId?: InputMaybe<Order_By>;
  authLinkedinClientSecret?: InputMaybe<Order_By>;
  authLinkedinScope?: InputMaybe<Order_By>;
  authLocaleDefault?: InputMaybe<Order_By>;
  authLogLevel?: InputMaybe<Order_By>;
  authMfaTotpIssuer?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmsTwilioAccountSid?: InputMaybe<Order_By>;
  authSmsTwilioAuthToken?: InputMaybe<Order_By>;
  authSmsTwilioFrom?: InputMaybe<Order_By>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Order_By>;
  authSmtpHost?: InputMaybe<Order_By>;
  authSmtpPass?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  authSmtpSender?: InputMaybe<Order_By>;
  authSmtpUser?: InputMaybe<Order_By>;
  authSpotifyClientId?: InputMaybe<Order_By>;
  authSpotifyClientSecret?: InputMaybe<Order_By>;
  authSpotifyScope?: InputMaybe<Order_By>;
  authTwitchClientId?: InputMaybe<Order_By>;
  authTwitchClientSecret?: InputMaybe<Order_By>;
  authTwitchScope?: InputMaybe<Order_By>;
  authTwitterConsumerKey?: InputMaybe<Order_By>;
  authTwitterConsumerSecret?: InputMaybe<Order_By>;
  authUserDefaultAllowedRoles?: InputMaybe<Order_By>;
  authUserDefaultRole?: InputMaybe<Order_By>;
  authUserSessionVariableFields?: InputMaybe<Order_By>;
  authWindowsLiveClientId?: InputMaybe<Order_By>;
  authWindowsLiveClientSecret?: InputMaybe<Order_By>;
  authWindowsLiveScope?: InputMaybe<Order_By>;
  authWorkOsClientId?: InputMaybe<Order_By>;
  authWorkOsClientSecret?: InputMaybe<Order_By>;
  authWorkOsDefaultConnection?: InputMaybe<Order_By>;
  authWorkOsDefaultDomain?: InputMaybe<Order_By>;
  authWorkOsDefaultOrganization?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
  emailTemplatesS3Key?: InputMaybe<Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  hasuraAuthVersion?: InputMaybe<Order_By>;
  hasuraGraphqlAdminSecret?: InputMaybe<Order_By>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Order_By>;
  hasuraGraphqlEnabledApis?: InputMaybe<Order_By>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Order_By>;
  hasuraGraphqlJwtSecret?: InputMaybe<Order_By>;
  hasuraStorageVersion?: InputMaybe<Order_By>;
  hasuraVersion?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  planId?: InputMaybe<Order_By>;
  postgresDatabase?: InputMaybe<Order_By>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: InputMaybe<Order_By>;
  postgresPassword?: InputMaybe<Order_By>;
  postgresSchemaMigrationPassword?: InputMaybe<Order_By>;
  postgresSchemaMigrationUser?: InputMaybe<Order_By>;
  postgresUser?: InputMaybe<Order_By>;
  postgresVersion?: InputMaybe<Order_By>;
  regionId?: InputMaybe<Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeSubscriptionId?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  webhookSecret?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Apps_Min_Fields = {
  __typename?: 'apps_min_fields';
  AuthSmtpAuthMethod?: Maybe<Scalars['String']>;
  S3AccessKey?: Maybe<Scalars['String']>;
  S3Bucket?: Maybe<Scalars['String']>;
  S3Endpoint?: Maybe<Scalars['String']>;
  S3SecretKey?: Maybe<Scalars['String']>;
  StorageForceDownloadForContentTypes?: Maybe<Scalars['String']>;
  StorageLogLevel?: Maybe<Scalars['String']>;
  authAccessControlAllowedEmailDomains?: Maybe<Scalars['String']>;
  authAccessControlAllowedEmails?: Maybe<Scalars['String']>;
  authAccessControlAllowedRedirectUrls?: Maybe<Scalars['String']>;
  authAccessControlBlockedEmailDomains?: Maybe<Scalars['String']>;
  authAccessControlBlockedEmails?: Maybe<Scalars['String']>;
  authAccessTokenExpiresIn?: Maybe<Scalars['Int']>;
  authAllowedLocales?: Maybe<Scalars['String']>;
  authAppName?: Maybe<Scalars['String']>;
  authAppleClientId?: Maybe<Scalars['String']>;
  authAppleKeyId?: Maybe<Scalars['String']>;
  authApplePrivateKey?: Maybe<Scalars['String']>;
  authAppleScope?: Maybe<Scalars['String']>;
  authAppleTeamId?: Maybe<Scalars['String']>;
  authClientUrl?: Maybe<Scalars['String']>;
  authDiscordClientId?: Maybe<Scalars['String']>;
  authDiscordClientSecret?: Maybe<Scalars['String']>;
  authDiscordScope?: Maybe<Scalars['String']>;
  authEmailTemplateFetchUrl?: Maybe<Scalars['String']>;
  authFacebookClientId?: Maybe<Scalars['String']>;
  authFacebookClientSecret?: Maybe<Scalars['String']>;
  authFacebookProfileFields?: Maybe<Scalars['String']>;
  authFacebookScope?: Maybe<Scalars['String']>;
  authGithubClientId?: Maybe<Scalars['String']>;
  authGithubClientSecret?: Maybe<Scalars['String']>;
  authGithubScope?: Maybe<Scalars['String']>;
  authGoogleClientId?: Maybe<Scalars['String']>;
  authGoogleClientSecret?: Maybe<Scalars['String']>;
  authGoogleScope?: Maybe<Scalars['String']>;
  authGravatarDefault?: Maybe<Scalars['String']>;
  authGravatarRating?: Maybe<Scalars['String']>;
  authLinkedinClientId?: Maybe<Scalars['String']>;
  authLinkedinClientSecret?: Maybe<Scalars['String']>;
  authLinkedinScope?: Maybe<Scalars['String']>;
  authLocaleDefault?: Maybe<Scalars['String']>;
  authLogLevel?: Maybe<Scalars['String']>;
  authMfaTotpIssuer?: Maybe<Scalars['String']>;
  authPasswordMinLength?: Maybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Int']>;
  authSmsTwilioAccountSid?: Maybe<Scalars['String']>;
  authSmsTwilioAuthToken?: Maybe<Scalars['String']>;
  authSmsTwilioFrom?: Maybe<Scalars['String']>;
  authSmsTwilioMessagingServiceId?: Maybe<Scalars['String']>;
  authSmtpHost?: Maybe<Scalars['String']>;
  authSmtpPass?: Maybe<Scalars['String']>;
  authSmtpPort?: Maybe<Scalars['Int']>;
  authSmtpSender?: Maybe<Scalars['String']>;
  authSmtpUser?: Maybe<Scalars['String']>;
  authSpotifyClientId?: Maybe<Scalars['String']>;
  authSpotifyClientSecret?: Maybe<Scalars['String']>;
  authSpotifyScope?: Maybe<Scalars['String']>;
  authTwitchClientId?: Maybe<Scalars['String']>;
  authTwitchClientSecret?: Maybe<Scalars['String']>;
  authTwitchScope?: Maybe<Scalars['String']>;
  authTwitterConsumerKey?: Maybe<Scalars['String']>;
  authTwitterConsumerSecret?: Maybe<Scalars['String']>;
  authUserDefaultAllowedRoles?: Maybe<Scalars['String']>;
  authUserDefaultRole?: Maybe<Scalars['String']>;
  authUserSessionVariableFields?: Maybe<Scalars['String']>;
  authWindowsLiveClientId?: Maybe<Scalars['String']>;
  authWindowsLiveClientSecret?: Maybe<Scalars['String']>;
  authWindowsLiveScope?: Maybe<Scalars['String']>;
  authWorkOsClientId?: Maybe<Scalars['String']>;
  authWorkOsClientSecret?: Maybe<Scalars['String']>;
  authWorkOsDefaultConnection?: Maybe<Scalars['String']>;
  authWorkOsDefaultDomain?: Maybe<Scalars['String']>;
  authWorkOsDefaultOrganization?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  desiredState?: Maybe<Scalars['Int']>;
  emailTemplatesS3Key?: Maybe<Scalars['String']>;
  githubRepositoryId?: Maybe<Scalars['uuid']>;
  hasuraAuthVersion?: Maybe<Scalars['String']>;
  hasuraGraphqlAdminSecret?: Maybe<Scalars['String']>;
  hasuraGraphqlDatabaseUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlEnabledApis?: Maybe<Scalars['String']>;
  hasuraGraphqlGraphqlUrl?: Maybe<Scalars['String']>;
  hasuraGraphqlJwtSecret?: Maybe<Scalars['String']>;
  hasuraStorageVersion?: Maybe<Scalars['String']>;
  hasuraVersion?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  nhostBaseFolder?: Maybe<Scalars['String']>;
  planId?: Maybe<Scalars['uuid']>;
  postgresDatabase?: Maybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: Maybe<Scalars['String']>;
  postgresPassword?: Maybe<Scalars['String']>;
  postgresSchemaMigrationPassword?: Maybe<Scalars['String']>;
  postgresSchemaMigrationUser?: Maybe<Scalars['String']>;
  postgresUser?: Maybe<Scalars['String']>;
  postgresVersion?: Maybe<Scalars['String']>;
  regionId?: Maybe<Scalars['uuid']>;
  repositoryProductionBranch?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  stripeSubscriptionId?: Maybe<Scalars['String']>;
  subdomain?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  webhookSecret?: Maybe<Scalars['String']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "apps" */
export type Apps_Min_Order_By = {
  AuthSmtpAuthMethod?: InputMaybe<Order_By>;
  S3AccessKey?: InputMaybe<Order_By>;
  S3Bucket?: InputMaybe<Order_By>;
  S3Endpoint?: InputMaybe<Order_By>;
  S3SecretKey?: InputMaybe<Order_By>;
  StorageForceDownloadForContentTypes?: InputMaybe<Order_By>;
  StorageLogLevel?: InputMaybe<Order_By>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlAllowedEmails?: InputMaybe<Order_By>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Order_By>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlBlockedEmails?: InputMaybe<Order_By>;
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authAllowedLocales?: InputMaybe<Order_By>;
  authAppName?: InputMaybe<Order_By>;
  authAppleClientId?: InputMaybe<Order_By>;
  authAppleKeyId?: InputMaybe<Order_By>;
  authApplePrivateKey?: InputMaybe<Order_By>;
  authAppleScope?: InputMaybe<Order_By>;
  authAppleTeamId?: InputMaybe<Order_By>;
  authClientUrl?: InputMaybe<Order_By>;
  authDiscordClientId?: InputMaybe<Order_By>;
  authDiscordClientSecret?: InputMaybe<Order_By>;
  authDiscordScope?: InputMaybe<Order_By>;
  authEmailTemplateFetchUrl?: InputMaybe<Order_By>;
  authFacebookClientId?: InputMaybe<Order_By>;
  authFacebookClientSecret?: InputMaybe<Order_By>;
  authFacebookProfileFields?: InputMaybe<Order_By>;
  authFacebookScope?: InputMaybe<Order_By>;
  authGithubClientId?: InputMaybe<Order_By>;
  authGithubClientSecret?: InputMaybe<Order_By>;
  authGithubScope?: InputMaybe<Order_By>;
  authGoogleClientId?: InputMaybe<Order_By>;
  authGoogleClientSecret?: InputMaybe<Order_By>;
  authGoogleScope?: InputMaybe<Order_By>;
  authGravatarDefault?: InputMaybe<Order_By>;
  authGravatarRating?: InputMaybe<Order_By>;
  authLinkedinClientId?: InputMaybe<Order_By>;
  authLinkedinClientSecret?: InputMaybe<Order_By>;
  authLinkedinScope?: InputMaybe<Order_By>;
  authLocaleDefault?: InputMaybe<Order_By>;
  authLogLevel?: InputMaybe<Order_By>;
  authMfaTotpIssuer?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmsTwilioAccountSid?: InputMaybe<Order_By>;
  authSmsTwilioAuthToken?: InputMaybe<Order_By>;
  authSmsTwilioFrom?: InputMaybe<Order_By>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Order_By>;
  authSmtpHost?: InputMaybe<Order_By>;
  authSmtpPass?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  authSmtpSender?: InputMaybe<Order_By>;
  authSmtpUser?: InputMaybe<Order_By>;
  authSpotifyClientId?: InputMaybe<Order_By>;
  authSpotifyClientSecret?: InputMaybe<Order_By>;
  authSpotifyScope?: InputMaybe<Order_By>;
  authTwitchClientId?: InputMaybe<Order_By>;
  authTwitchClientSecret?: InputMaybe<Order_By>;
  authTwitchScope?: InputMaybe<Order_By>;
  authTwitterConsumerKey?: InputMaybe<Order_By>;
  authTwitterConsumerSecret?: InputMaybe<Order_By>;
  authUserDefaultAllowedRoles?: InputMaybe<Order_By>;
  authUserDefaultRole?: InputMaybe<Order_By>;
  authUserSessionVariableFields?: InputMaybe<Order_By>;
  authWindowsLiveClientId?: InputMaybe<Order_By>;
  authWindowsLiveClientSecret?: InputMaybe<Order_By>;
  authWindowsLiveScope?: InputMaybe<Order_By>;
  authWorkOsClientId?: InputMaybe<Order_By>;
  authWorkOsClientSecret?: InputMaybe<Order_By>;
  authWorkOsDefaultConnection?: InputMaybe<Order_By>;
  authWorkOsDefaultDomain?: InputMaybe<Order_By>;
  authWorkOsDefaultOrganization?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
  emailTemplatesS3Key?: InputMaybe<Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  hasuraAuthVersion?: InputMaybe<Order_By>;
  hasuraGraphqlAdminSecret?: InputMaybe<Order_By>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Order_By>;
  hasuraGraphqlEnabledApis?: InputMaybe<Order_By>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Order_By>;
  hasuraGraphqlJwtSecret?: InputMaybe<Order_By>;
  hasuraStorageVersion?: InputMaybe<Order_By>;
  hasuraVersion?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  planId?: InputMaybe<Order_By>;
  postgresDatabase?: InputMaybe<Order_By>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: InputMaybe<Order_By>;
  postgresPassword?: InputMaybe<Order_By>;
  postgresSchemaMigrationPassword?: InputMaybe<Order_By>;
  postgresSchemaMigrationUser?: InputMaybe<Order_By>;
  postgresUser?: InputMaybe<Order_By>;
  postgresVersion?: InputMaybe<Order_By>;
  regionId?: InputMaybe<Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeSubscriptionId?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  webhookSecret?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "apps" */
export type Apps_Mutation_Response = {
  __typename?: 'apps_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Apps>;
};

/** input type for inserting object relation for remote table "apps" */
export type Apps_Obj_Rel_Insert_Input = {
  data: Apps_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};

/** on_conflict condition type for table "apps" */
export type Apps_On_Conflict = {
  constraint: Apps_Constraint;
  update_columns?: Array<Apps_Update_Column>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** Ordering options when selecting data from "apps". */
export type Apps_Order_By = {
  AuthSmtpAuthMethod?: InputMaybe<Order_By>;
  AuthSmtpSecure?: InputMaybe<Order_By>;
  S3AccessKey?: InputMaybe<Order_By>;
  S3Bucket?: InputMaybe<Order_By>;
  S3Endpoint?: InputMaybe<Order_By>;
  S3SecretKey?: InputMaybe<Order_By>;
  S3SslEnabled?: InputMaybe<Order_By>;
  StorageForceDownloadForContentTypes?: InputMaybe<Order_By>;
  StorageLogLevel?: InputMaybe<Order_By>;
  StorageSwaggerEnabled?: InputMaybe<Order_By>;
  appStates_aggregate?: InputMaybe<AppStateHistory_Aggregate_Order_By>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlAllowedEmails?: InputMaybe<Order_By>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Order_By>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Order_By>;
  authAccessControlBlockedEmails?: InputMaybe<Order_By>;
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authAllowedLocales?: InputMaybe<Order_By>;
  authAnonymousUsersEnabled?: InputMaybe<Order_By>;
  authAppName?: InputMaybe<Order_By>;
  authAppleClientId?: InputMaybe<Order_By>;
  authAppleEnabled?: InputMaybe<Order_By>;
  authAppleKeyId?: InputMaybe<Order_By>;
  authApplePrivateKey?: InputMaybe<Order_By>;
  authAppleScope?: InputMaybe<Order_By>;
  authAppleTeamId?: InputMaybe<Order_By>;
  authClientUrl?: InputMaybe<Order_By>;
  authDisableNewUsers?: InputMaybe<Order_By>;
  authDiscordClientId?: InputMaybe<Order_By>;
  authDiscordClientSecret?: InputMaybe<Order_By>;
  authDiscordEnabled?: InputMaybe<Order_By>;
  authDiscordScope?: InputMaybe<Order_By>;
  authEmailPasswordlessEnabled?: InputMaybe<Order_By>;
  authEmailSigninEmailVerifiedRequired?: InputMaybe<Order_By>;
  authEmailTemplateFetchUrl?: InputMaybe<Order_By>;
  authEmailsEnabled?: InputMaybe<Order_By>;
  authFacebookClientId?: InputMaybe<Order_By>;
  authFacebookClientSecret?: InputMaybe<Order_By>;
  authFacebookEnabled?: InputMaybe<Order_By>;
  authFacebookProfileFields?: InputMaybe<Order_By>;
  authFacebookScope?: InputMaybe<Order_By>;
  authGithubClientId?: InputMaybe<Order_By>;
  authGithubClientSecret?: InputMaybe<Order_By>;
  authGithubEnabled?: InputMaybe<Order_By>;
  authGithubScope?: InputMaybe<Order_By>;
  authGoogleClientId?: InputMaybe<Order_By>;
  authGoogleClientSecret?: InputMaybe<Order_By>;
  authGoogleEnabled?: InputMaybe<Order_By>;
  authGoogleScope?: InputMaybe<Order_By>;
  authGravatarDefault?: InputMaybe<Order_By>;
  authGravatarEnabled?: InputMaybe<Order_By>;
  authGravatarRating?: InputMaybe<Order_By>;
  authJwtCustomClaims?: InputMaybe<Order_By>;
  authLinkedinClientId?: InputMaybe<Order_By>;
  authLinkedinClientSecret?: InputMaybe<Order_By>;
  authLinkedinEnabled?: InputMaybe<Order_By>;
  authLinkedinScope?: InputMaybe<Order_By>;
  authLocaleDefault?: InputMaybe<Order_By>;
  authLogLevel?: InputMaybe<Order_By>;
  authMfaEnabled?: InputMaybe<Order_By>;
  authMfaTotpIssuer?: InputMaybe<Order_By>;
  authPasswordHibpEnabled?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmsPasswordlessEnabled?: InputMaybe<Order_By>;
  authSmsTwilioAccountSid?: InputMaybe<Order_By>;
  authSmsTwilioAuthToken?: InputMaybe<Order_By>;
  authSmsTwilioFrom?: InputMaybe<Order_By>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Order_By>;
  authSmtpHost?: InputMaybe<Order_By>;
  authSmtpPass?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  authSmtpSender?: InputMaybe<Order_By>;
  authSmtpUser?: InputMaybe<Order_By>;
  authSpotifyClientId?: InputMaybe<Order_By>;
  authSpotifyClientSecret?: InputMaybe<Order_By>;
  authSpotifyEnabled?: InputMaybe<Order_By>;
  authSpotifyScope?: InputMaybe<Order_By>;
  authTwitchClientId?: InputMaybe<Order_By>;
  authTwitchClientSecret?: InputMaybe<Order_By>;
  authTwitchEnabled?: InputMaybe<Order_By>;
  authTwitchScope?: InputMaybe<Order_By>;
  authTwitterConsumerKey?: InputMaybe<Order_By>;
  authTwitterConsumerSecret?: InputMaybe<Order_By>;
  authTwitterEnabled?: InputMaybe<Order_By>;
  authUserDefaultAllowedRoles?: InputMaybe<Order_By>;
  authUserDefaultRole?: InputMaybe<Order_By>;
  authUserSessionVariableFields?: InputMaybe<Order_By>;
  authWebAuthnEnabled?: InputMaybe<Order_By>;
  authWindowsLiveClientId?: InputMaybe<Order_By>;
  authWindowsLiveClientSecret?: InputMaybe<Order_By>;
  authWindowsLiveEnabled?: InputMaybe<Order_By>;
  authWindowsLiveScope?: InputMaybe<Order_By>;
  authWorkOsClientId?: InputMaybe<Order_By>;
  authWorkOsClientSecret?: InputMaybe<Order_By>;
  authWorkOsDefaultConnection?: InputMaybe<Order_By>;
  authWorkOsDefaultDomain?: InputMaybe<Order_By>;
  authWorkOsDefaultOrganization?: InputMaybe<Order_By>;
  authWorkOsEnabled?: InputMaybe<Order_By>;
  autoUpdate?: InputMaybe<Order_By>;
  backups_aggregate?: InputMaybe<Backups_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creator?: InputMaybe<Users_Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  deployments_aggregate?: InputMaybe<Deployments_Aggregate_Order_By>;
  desiredAppState?: InputMaybe<AppStates_Order_By>;
  desiredState?: InputMaybe<Order_By>;
  emailTemplatesS3Key?: InputMaybe<Order_By>;
  environmentVariables_aggregate?: InputMaybe<EnvironmentVariables_Aggregate_Order_By>;
  featureFlags_aggregate?: InputMaybe<FeatureFlags_Aggregate_Order_By>;
  githubRepository?: InputMaybe<GithubRepositories_Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  hasuraAuthVersion?: InputMaybe<Order_By>;
  hasuraGraphqlAdminSecret?: InputMaybe<Order_By>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Order_By>;
  hasuraGraphqlEnableConsole?: InputMaybe<Order_By>;
  hasuraGraphqlEnableRemoteSchemaPermissions?: InputMaybe<Order_By>;
  hasuraGraphqlEnabledApis?: InputMaybe<Order_By>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Order_By>;
  hasuraGraphqlJwtSecret?: InputMaybe<Order_By>;
  hasuraStorageVersion?: InputMaybe<Order_By>;
  hasuraVersion?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isProvisioned?: InputMaybe<Order_By>;
  metadataFunctions?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  paused?: InputMaybe<Order_By>;
  plan?: InputMaybe<Plans_Order_By>;
  planId?: InputMaybe<Order_By>;
  postgresDatabase?: InputMaybe<Order_By>;
  postgresHost?: InputMaybe<Order_By>;
  postgresPassword?: InputMaybe<Order_By>;
  postgresPublicAccess?: InputMaybe<Order_By>;
  postgresSchemaMigrationPassword?: InputMaybe<Order_By>;
  postgresSchemaMigrationUser?: InputMaybe<Order_By>;
  postgresUser?: InputMaybe<Order_By>;
  postgresVersion?: InputMaybe<Order_By>;
  providersUpdated?: InputMaybe<Order_By>;
  region?: InputMaybe<Regions_Order_By>;
  regionId?: InputMaybe<Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeSubscriptionId?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  webhookSecret?: InputMaybe<Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: apps */
export type Apps_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Apps_Prepend_Input = {
  authJwtCustomClaims?: InputMaybe<Scalars['jsonb']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
};

/** select columns of table "apps" */
export enum Apps_Select_Column {
  /** column name */
  AuthSmtpAuthMethod = 'AuthSmtpAuthMethod',
  /** column name */
  AuthSmtpSecure = 'AuthSmtpSecure',
  /** column name */
  S3AccessKey = 'S3AccessKey',
  /** column name */
  S3Bucket = 'S3Bucket',
  /** column name */
  S3Endpoint = 'S3Endpoint',
  /** column name */
  S3SecretKey = 'S3SecretKey',
  /** column name */
  S3SslEnabled = 'S3SslEnabled',
  /** column name */
  StorageForceDownloadForContentTypes = 'StorageForceDownloadForContentTypes',
  /** column name */
  StorageLogLevel = 'StorageLogLevel',
  /** column name */
  StorageSwaggerEnabled = 'StorageSwaggerEnabled',
  /** column name */
  AuthAccessControlAllowedEmailDomains = 'authAccessControlAllowedEmailDomains',
  /** column name */
  AuthAccessControlAllowedEmails = 'authAccessControlAllowedEmails',
  /** column name */
  AuthAccessControlAllowedRedirectUrls = 'authAccessControlAllowedRedirectUrls',
  /** column name */
  AuthAccessControlBlockedEmailDomains = 'authAccessControlBlockedEmailDomains',
  /** column name */
  AuthAccessControlBlockedEmails = 'authAccessControlBlockedEmails',
  /** column name */
  AuthAccessTokenExpiresIn = 'authAccessTokenExpiresIn',
  /** column name */
  AuthAllowedLocales = 'authAllowedLocales',
  /** column name */
  AuthAnonymousUsersEnabled = 'authAnonymousUsersEnabled',
  /** column name */
  AuthAppName = 'authAppName',
  /** column name */
  AuthAppleClientId = 'authAppleClientId',
  /** column name */
  AuthAppleEnabled = 'authAppleEnabled',
  /** column name */
  AuthAppleKeyId = 'authAppleKeyId',
  /** column name */
  AuthApplePrivateKey = 'authApplePrivateKey',
  /** column name */
  AuthAppleScope = 'authAppleScope',
  /** column name */
  AuthAppleTeamId = 'authAppleTeamId',
  /** column name */
  AuthClientUrl = 'authClientUrl',
  /** column name */
  AuthDisableNewUsers = 'authDisableNewUsers',
  /** column name */
  AuthDiscordClientId = 'authDiscordClientId',
  /** column name */
  AuthDiscordClientSecret = 'authDiscordClientSecret',
  /** column name */
  AuthDiscordEnabled = 'authDiscordEnabled',
  /** column name */
  AuthDiscordScope = 'authDiscordScope',
  /** column name */
  AuthEmailPasswordlessEnabled = 'authEmailPasswordlessEnabled',
  /** column name */
  AuthEmailSigninEmailVerifiedRequired = 'authEmailSigninEmailVerifiedRequired',
  /** column name */
  AuthEmailTemplateFetchUrl = 'authEmailTemplateFetchUrl',
  /** column name */
  AuthEmailsEnabled = 'authEmailsEnabled',
  /** column name */
  AuthFacebookClientId = 'authFacebookClientId',
  /** column name */
  AuthFacebookClientSecret = 'authFacebookClientSecret',
  /** column name */
  AuthFacebookEnabled = 'authFacebookEnabled',
  /** column name */
  AuthFacebookProfileFields = 'authFacebookProfileFields',
  /** column name */
  AuthFacebookScope = 'authFacebookScope',
  /** column name */
  AuthGithubClientId = 'authGithubClientId',
  /** column name */
  AuthGithubClientSecret = 'authGithubClientSecret',
  /** column name */
  AuthGithubEnabled = 'authGithubEnabled',
  /** column name */
  AuthGithubScope = 'authGithubScope',
  /** column name */
  AuthGoogleClientId = 'authGoogleClientId',
  /** column name */
  AuthGoogleClientSecret = 'authGoogleClientSecret',
  /** column name */
  AuthGoogleEnabled = 'authGoogleEnabled',
  /** column name */
  AuthGoogleScope = 'authGoogleScope',
  /** column name */
  AuthGravatarDefault = 'authGravatarDefault',
  /** column name */
  AuthGravatarEnabled = 'authGravatarEnabled',
  /** column name */
  AuthGravatarRating = 'authGravatarRating',
  /** column name */
  AuthJwtCustomClaims = 'authJwtCustomClaims',
  /** column name */
  AuthLinkedinClientId = 'authLinkedinClientId',
  /** column name */
  AuthLinkedinClientSecret = 'authLinkedinClientSecret',
  /** column name */
  AuthLinkedinEnabled = 'authLinkedinEnabled',
  /** column name */
  AuthLinkedinScope = 'authLinkedinScope',
  /** column name */
  AuthLocaleDefault = 'authLocaleDefault',
  /** column name */
  AuthLogLevel = 'authLogLevel',
  /** column name */
  AuthMfaEnabled = 'authMfaEnabled',
  /** column name */
  AuthMfaTotpIssuer = 'authMfaTotpIssuer',
  /** column name */
  AuthPasswordHibpEnabled = 'authPasswordHibpEnabled',
  /** column name */
  AuthPasswordMinLength = 'authPasswordMinLength',
  /** column name */
  AuthRefreshTokenExpiresIn = 'authRefreshTokenExpiresIn',
  /** column name */
  AuthSmsPasswordlessEnabled = 'authSmsPasswordlessEnabled',
  /** column name */
  AuthSmsTwilioAccountSid = 'authSmsTwilioAccountSid',
  /** column name */
  AuthSmsTwilioAuthToken = 'authSmsTwilioAuthToken',
  /** column name */
  AuthSmsTwilioFrom = 'authSmsTwilioFrom',
  /** column name */
  AuthSmsTwilioMessagingServiceId = 'authSmsTwilioMessagingServiceId',
  /** column name */
  AuthSmtpHost = 'authSmtpHost',
  /** column name */
  AuthSmtpPass = 'authSmtpPass',
  /** column name */
  AuthSmtpPort = 'authSmtpPort',
  /** column name */
  AuthSmtpSender = 'authSmtpSender',
  /** column name */
  AuthSmtpUser = 'authSmtpUser',
  /** column name */
  AuthSpotifyClientId = 'authSpotifyClientId',
  /** column name */
  AuthSpotifyClientSecret = 'authSpotifyClientSecret',
  /** column name */
  AuthSpotifyEnabled = 'authSpotifyEnabled',
  /** column name */
  AuthSpotifyScope = 'authSpotifyScope',
  /** column name */
  AuthTwitchClientId = 'authTwitchClientId',
  /** column name */
  AuthTwitchClientSecret = 'authTwitchClientSecret',
  /** column name */
  AuthTwitchEnabled = 'authTwitchEnabled',
  /** column name */
  AuthTwitchScope = 'authTwitchScope',
  /** column name */
  AuthTwitterConsumerKey = 'authTwitterConsumerKey',
  /** column name */
  AuthTwitterConsumerSecret = 'authTwitterConsumerSecret',
  /** column name */
  AuthTwitterEnabled = 'authTwitterEnabled',
  /** column name */
  AuthUserDefaultAllowedRoles = 'authUserDefaultAllowedRoles',
  /** column name */
  AuthUserDefaultRole = 'authUserDefaultRole',
  /** column name */
  AuthUserSessionVariableFields = 'authUserSessionVariableFields',
  /** column name */
  AuthWebAuthnEnabled = 'authWebAuthnEnabled',
  /** column name */
  AuthWindowsLiveClientId = 'authWindowsLiveClientId',
  /** column name */
  AuthWindowsLiveClientSecret = 'authWindowsLiveClientSecret',
  /** column name */
  AuthWindowsLiveEnabled = 'authWindowsLiveEnabled',
  /** column name */
  AuthWindowsLiveScope = 'authWindowsLiveScope',
  /** column name */
  AuthWorkOsClientId = 'authWorkOsClientId',
  /** column name */
  AuthWorkOsClientSecret = 'authWorkOsClientSecret',
  /** column name */
  AuthWorkOsDefaultConnection = 'authWorkOsDefaultConnection',
  /** column name */
  AuthWorkOsDefaultDomain = 'authWorkOsDefaultDomain',
  /** column name */
  AuthWorkOsDefaultOrganization = 'authWorkOsDefaultOrganization',
  /** column name */
  AuthWorkOsEnabled = 'authWorkOsEnabled',
  /** column name */
  AutoUpdate = 'autoUpdate',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  DesiredState = 'desiredState',
  /** column name */
  EmailTemplatesS3Key = 'emailTemplatesS3Key',
  /** column name */
  GithubRepositoryId = 'githubRepositoryId',
  /** column name */
  HasuraAuthVersion = 'hasuraAuthVersion',
  /** column name */
  HasuraGraphqlAdminSecret = 'hasuraGraphqlAdminSecret',
  /** column name */
  HasuraGraphqlDatabaseUrl = 'hasuraGraphqlDatabaseUrl',
  /** column name */
  HasuraGraphqlEnableConsole = 'hasuraGraphqlEnableConsole',
  /** column name */
  HasuraGraphqlEnableRemoteSchemaPermissions = 'hasuraGraphqlEnableRemoteSchemaPermissions',
  /** column name */
  HasuraGraphqlEnabledApis = 'hasuraGraphqlEnabledApis',
  /** column name */
  HasuraGraphqlGraphqlUrl = 'hasuraGraphqlGraphqlUrl',
  /** column name */
  HasuraGraphqlJwtSecret = 'hasuraGraphqlJwtSecret',
  /** column name */
  HasuraStorageVersion = 'hasuraStorageVersion',
  /** column name */
  HasuraVersion = 'hasuraVersion',
  /** column name */
  Id = 'id',
  /** column name */
  IsProvisioned = 'isProvisioned',
  /** column name */
  MetadataFunctions = 'metadataFunctions',
  /** column name */
  Name = 'name',
  /** column name */
  NhostBaseFolder = 'nhostBaseFolder',
  /** column name */
  Paused = 'paused',
  /** column name */
  PlanId = 'planId',
  /** column name */
  PostgresDatabase = 'postgresDatabase',
  /** column name */
  PostgresHost = 'postgresHost',
  /** column name */
  PostgresPassword = 'postgresPassword',
  /** column name */
  PostgresPublicAccess = 'postgresPublicAccess',
  /** column name */
  PostgresSchemaMigrationPassword = 'postgresSchemaMigrationPassword',
  /** column name */
  PostgresSchemaMigrationUser = 'postgresSchemaMigrationUser',
  /** column name */
  PostgresUser = 'postgresUser',
  /** column name */
  PostgresVersion = 'postgresVersion',
  /** column name */
  ProvidersUpdated = 'providersUpdated',
  /** column name */
  RegionId = 'regionId',
  /** column name */
  RepositoryProductionBranch = 'repositoryProductionBranch',
  /** column name */
  Slug = 'slug',
  /** column name */
  StripeSubscriptionId = 'stripeSubscriptionId',
  /** column name */
  Subdomain = 'subdomain',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WebhookSecret = 'webhookSecret',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** select "apps_aggregate_bool_exp_bool_and_arguments_columns" columns of table "apps" */
export enum Apps_Select_Column_Apps_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  AuthSmtpSecure = 'AuthSmtpSecure',
  /** column name */
  S3SslEnabled = 'S3SslEnabled',
  /** column name */
  StorageSwaggerEnabled = 'StorageSwaggerEnabled',
  /** column name */
  AuthAnonymousUsersEnabled = 'authAnonymousUsersEnabled',
  /** column name */
  AuthAppleEnabled = 'authAppleEnabled',
  /** column name */
  AuthDisableNewUsers = 'authDisableNewUsers',
  /** column name */
  AuthDiscordEnabled = 'authDiscordEnabled',
  /** column name */
  AuthEmailPasswordlessEnabled = 'authEmailPasswordlessEnabled',
  /** column name */
  AuthEmailSigninEmailVerifiedRequired = 'authEmailSigninEmailVerifiedRequired',
  /** column name */
  AuthEmailsEnabled = 'authEmailsEnabled',
  /** column name */
  AuthFacebookEnabled = 'authFacebookEnabled',
  /** column name */
  AuthGithubEnabled = 'authGithubEnabled',
  /** column name */
  AuthGoogleEnabled = 'authGoogleEnabled',
  /** column name */
  AuthGravatarEnabled = 'authGravatarEnabled',
  /** column name */
  AuthLinkedinEnabled = 'authLinkedinEnabled',
  /** column name */
  AuthMfaEnabled = 'authMfaEnabled',
  /** column name */
  AuthPasswordHibpEnabled = 'authPasswordHibpEnabled',
  /** column name */
  AuthSmsPasswordlessEnabled = 'authSmsPasswordlessEnabled',
  /** column name */
  AuthSpotifyEnabled = 'authSpotifyEnabled',
  /** column name */
  AuthTwitchEnabled = 'authTwitchEnabled',
  /** column name */
  AuthTwitterEnabled = 'authTwitterEnabled',
  /** column name */
  AuthWebAuthnEnabled = 'authWebAuthnEnabled',
  /** column name */
  AuthWindowsLiveEnabled = 'authWindowsLiveEnabled',
  /** column name */
  AuthWorkOsEnabled = 'authWorkOsEnabled',
  /** column name */
  AutoUpdate = 'autoUpdate',
  /** column name */
  HasuraGraphqlEnableConsole = 'hasuraGraphqlEnableConsole',
  /** column name */
  HasuraGraphqlEnableRemoteSchemaPermissions = 'hasuraGraphqlEnableRemoteSchemaPermissions',
  /** column name */
  IsProvisioned = 'isProvisioned',
  /** column name */
  Paused = 'paused',
  /** column name */
  PostgresPublicAccess = 'postgresPublicAccess',
  /** column name */
  ProvidersUpdated = 'providersUpdated'
}

/** select "apps_aggregate_bool_exp_bool_or_arguments_columns" columns of table "apps" */
export enum Apps_Select_Column_Apps_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  AuthSmtpSecure = 'AuthSmtpSecure',
  /** column name */
  S3SslEnabled = 'S3SslEnabled',
  /** column name */
  StorageSwaggerEnabled = 'StorageSwaggerEnabled',
  /** column name */
  AuthAnonymousUsersEnabled = 'authAnonymousUsersEnabled',
  /** column name */
  AuthAppleEnabled = 'authAppleEnabled',
  /** column name */
  AuthDisableNewUsers = 'authDisableNewUsers',
  /** column name */
  AuthDiscordEnabled = 'authDiscordEnabled',
  /** column name */
  AuthEmailPasswordlessEnabled = 'authEmailPasswordlessEnabled',
  /** column name */
  AuthEmailSigninEmailVerifiedRequired = 'authEmailSigninEmailVerifiedRequired',
  /** column name */
  AuthEmailsEnabled = 'authEmailsEnabled',
  /** column name */
  AuthFacebookEnabled = 'authFacebookEnabled',
  /** column name */
  AuthGithubEnabled = 'authGithubEnabled',
  /** column name */
  AuthGoogleEnabled = 'authGoogleEnabled',
  /** column name */
  AuthGravatarEnabled = 'authGravatarEnabled',
  /** column name */
  AuthLinkedinEnabled = 'authLinkedinEnabled',
  /** column name */
  AuthMfaEnabled = 'authMfaEnabled',
  /** column name */
  AuthPasswordHibpEnabled = 'authPasswordHibpEnabled',
  /** column name */
  AuthSmsPasswordlessEnabled = 'authSmsPasswordlessEnabled',
  /** column name */
  AuthSpotifyEnabled = 'authSpotifyEnabled',
  /** column name */
  AuthTwitchEnabled = 'authTwitchEnabled',
  /** column name */
  AuthTwitterEnabled = 'authTwitterEnabled',
  /** column name */
  AuthWebAuthnEnabled = 'authWebAuthnEnabled',
  /** column name */
  AuthWindowsLiveEnabled = 'authWindowsLiveEnabled',
  /** column name */
  AuthWorkOsEnabled = 'authWorkOsEnabled',
  /** column name */
  AutoUpdate = 'autoUpdate',
  /** column name */
  HasuraGraphqlEnableConsole = 'hasuraGraphqlEnableConsole',
  /** column name */
  HasuraGraphqlEnableRemoteSchemaPermissions = 'hasuraGraphqlEnableRemoteSchemaPermissions',
  /** column name */
  IsProvisioned = 'isProvisioned',
  /** column name */
  Paused = 'paused',
  /** column name */
  PostgresPublicAccess = 'postgresPublicAccess',
  /** column name */
  ProvidersUpdated = 'providersUpdated'
}

/** input type for updating data in table "apps" */
export type Apps_Set_Input = {
  AuthSmtpAuthMethod?: InputMaybe<Scalars['String']>;
  AuthSmtpSecure?: InputMaybe<Scalars['Boolean']>;
  S3AccessKey?: InputMaybe<Scalars['String']>;
  S3Bucket?: InputMaybe<Scalars['String']>;
  S3Endpoint?: InputMaybe<Scalars['String']>;
  S3SecretKey?: InputMaybe<Scalars['String']>;
  S3SslEnabled?: InputMaybe<Scalars['Boolean']>;
  StorageForceDownloadForContentTypes?: InputMaybe<Scalars['String']>;
  StorageLogLevel?: InputMaybe<Scalars['String']>;
  StorageSwaggerEnabled?: InputMaybe<Scalars['Boolean']>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedEmails?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmails?: InputMaybe<Scalars['String']>;
  authAccessTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authAllowedLocales?: InputMaybe<Scalars['String']>;
  authAnonymousUsersEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppName?: InputMaybe<Scalars['String']>;
  authAppleClientId?: InputMaybe<Scalars['String']>;
  authAppleEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppleKeyId?: InputMaybe<Scalars['String']>;
  authApplePrivateKey?: InputMaybe<Scalars['String']>;
  authAppleScope?: InputMaybe<Scalars['String']>;
  authAppleTeamId?: InputMaybe<Scalars['String']>;
  authClientUrl?: InputMaybe<Scalars['String']>;
  authDisableNewUsers?: InputMaybe<Scalars['Boolean']>;
  authDiscordClientId?: InputMaybe<Scalars['String']>;
  authDiscordClientSecret?: InputMaybe<Scalars['String']>;
  authDiscordEnabled?: InputMaybe<Scalars['Boolean']>;
  authDiscordScope?: InputMaybe<Scalars['String']>;
  authEmailPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authEmailSigninEmailVerifiedRequired?: InputMaybe<Scalars['Boolean']>;
  authEmailTemplateFetchUrl?: InputMaybe<Scalars['String']>;
  authEmailsEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookClientId?: InputMaybe<Scalars['String']>;
  authFacebookClientSecret?: InputMaybe<Scalars['String']>;
  authFacebookEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookProfileFields?: InputMaybe<Scalars['String']>;
  authFacebookScope?: InputMaybe<Scalars['String']>;
  authGithubClientId?: InputMaybe<Scalars['String']>;
  authGithubClientSecret?: InputMaybe<Scalars['String']>;
  authGithubEnabled?: InputMaybe<Scalars['Boolean']>;
  authGithubScope?: InputMaybe<Scalars['String']>;
  authGoogleClientId?: InputMaybe<Scalars['String']>;
  authGoogleClientSecret?: InputMaybe<Scalars['String']>;
  authGoogleEnabled?: InputMaybe<Scalars['Boolean']>;
  authGoogleScope?: InputMaybe<Scalars['String']>;
  authGravatarDefault?: InputMaybe<Scalars['String']>;
  authGravatarEnabled?: InputMaybe<Scalars['Boolean']>;
  authGravatarRating?: InputMaybe<Scalars['String']>;
  authJwtCustomClaims?: InputMaybe<Scalars['jsonb']>;
  authLinkedinClientId?: InputMaybe<Scalars['String']>;
  authLinkedinClientSecret?: InputMaybe<Scalars['String']>;
  authLinkedinEnabled?: InputMaybe<Scalars['Boolean']>;
  authLinkedinScope?: InputMaybe<Scalars['String']>;
  authLocaleDefault?: InputMaybe<Scalars['String']>;
  authLogLevel?: InputMaybe<Scalars['String']>;
  authMfaEnabled?: InputMaybe<Scalars['Boolean']>;
  authMfaTotpIssuer?: InputMaybe<Scalars['String']>;
  authPasswordHibpEnabled?: InputMaybe<Scalars['Boolean']>;
  authPasswordMinLength?: InputMaybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authSmsPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authSmsTwilioAccountSid?: InputMaybe<Scalars['String']>;
  authSmsTwilioAuthToken?: InputMaybe<Scalars['String']>;
  authSmsTwilioFrom?: InputMaybe<Scalars['String']>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Scalars['String']>;
  authSmtpHost?: InputMaybe<Scalars['String']>;
  authSmtpPass?: InputMaybe<Scalars['String']>;
  authSmtpPort?: InputMaybe<Scalars['Int']>;
  authSmtpSender?: InputMaybe<Scalars['String']>;
  authSmtpUser?: InputMaybe<Scalars['String']>;
  authSpotifyClientId?: InputMaybe<Scalars['String']>;
  authSpotifyClientSecret?: InputMaybe<Scalars['String']>;
  authSpotifyEnabled?: InputMaybe<Scalars['Boolean']>;
  authSpotifyScope?: InputMaybe<Scalars['String']>;
  authTwitchClientId?: InputMaybe<Scalars['String']>;
  authTwitchClientSecret?: InputMaybe<Scalars['String']>;
  authTwitchEnabled?: InputMaybe<Scalars['Boolean']>;
  authTwitchScope?: InputMaybe<Scalars['String']>;
  authTwitterConsumerKey?: InputMaybe<Scalars['String']>;
  authTwitterConsumerSecret?: InputMaybe<Scalars['String']>;
  authTwitterEnabled?: InputMaybe<Scalars['Boolean']>;
  authUserDefaultAllowedRoles?: InputMaybe<Scalars['String']>;
  authUserDefaultRole?: InputMaybe<Scalars['String']>;
  authUserSessionVariableFields?: InputMaybe<Scalars['String']>;
  authWebAuthnEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveClientId?: InputMaybe<Scalars['String']>;
  authWindowsLiveClientSecret?: InputMaybe<Scalars['String']>;
  authWindowsLiveEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveScope?: InputMaybe<Scalars['String']>;
  authWorkOsClientId?: InputMaybe<Scalars['String']>;
  authWorkOsClientSecret?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultConnection?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultDomain?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultOrganization?: InputMaybe<Scalars['String']>;
  authWorkOsEnabled?: InputMaybe<Scalars['Boolean']>;
  autoUpdate?: InputMaybe<Scalars['Boolean']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  desiredState?: InputMaybe<Scalars['Int']>;
  emailTemplatesS3Key?: InputMaybe<Scalars['String']>;
  githubRepositoryId?: InputMaybe<Scalars['uuid']>;
  hasuraAuthVersion?: InputMaybe<Scalars['String']>;
  hasuraGraphqlAdminSecret?: InputMaybe<Scalars['String']>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlEnableConsole?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnableRemoteSchemaPermissions?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnabledApis?: InputMaybe<Scalars['String']>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlJwtSecret?: InputMaybe<Scalars['String']>;
  hasuraStorageVersion?: InputMaybe<Scalars['String']>;
  hasuraVersion?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isProvisioned?: InputMaybe<Scalars['Boolean']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
  name?: InputMaybe<Scalars['String']>;
  nhostBaseFolder?: InputMaybe<Scalars['String']>;
  /** whether or not this app is paused */
  paused?: InputMaybe<Scalars['Boolean']>;
  planId?: InputMaybe<Scalars['uuid']>;
  postgresDatabase?: InputMaybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: InputMaybe<Scalars['String']>;
  postgresPassword?: InputMaybe<Scalars['String']>;
  postgresPublicAccess?: InputMaybe<Scalars['Boolean']>;
  postgresSchemaMigrationPassword?: InputMaybe<Scalars['String']>;
  postgresSchemaMigrationUser?: InputMaybe<Scalars['String']>;
  postgresUser?: InputMaybe<Scalars['String']>;
  postgresVersion?: InputMaybe<Scalars['String']>;
  providersUpdated?: InputMaybe<Scalars['Boolean']>;
  regionId?: InputMaybe<Scalars['uuid']>;
  repositoryProductionBranch?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  stripeSubscriptionId?: InputMaybe<Scalars['String']>;
  subdomain?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  webhookSecret?: InputMaybe<Scalars['String']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate stddev on columns */
export type Apps_Stddev_Fields = {
  __typename?: 'apps_stddev_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "apps" */
export type Apps_Stddev_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Apps_Stddev_Pop_Fields = {
  __typename?: 'apps_stddev_pop_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "apps" */
export type Apps_Stddev_Pop_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Apps_Stddev_Samp_Fields = {
  __typename?: 'apps_stddev_samp_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "apps" */
export type Apps_Stddev_Samp_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "apps" */
export type Apps_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Apps_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Apps_Stream_Cursor_Value_Input = {
  AuthSmtpAuthMethod?: InputMaybe<Scalars['String']>;
  AuthSmtpSecure?: InputMaybe<Scalars['Boolean']>;
  S3AccessKey?: InputMaybe<Scalars['String']>;
  S3Bucket?: InputMaybe<Scalars['String']>;
  S3Endpoint?: InputMaybe<Scalars['String']>;
  S3SecretKey?: InputMaybe<Scalars['String']>;
  S3SslEnabled?: InputMaybe<Scalars['Boolean']>;
  StorageForceDownloadForContentTypes?: InputMaybe<Scalars['String']>;
  StorageLogLevel?: InputMaybe<Scalars['String']>;
  StorageSwaggerEnabled?: InputMaybe<Scalars['Boolean']>;
  authAccessControlAllowedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedEmails?: InputMaybe<Scalars['String']>;
  authAccessControlAllowedRedirectUrls?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmailDomains?: InputMaybe<Scalars['String']>;
  authAccessControlBlockedEmails?: InputMaybe<Scalars['String']>;
  authAccessTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authAllowedLocales?: InputMaybe<Scalars['String']>;
  authAnonymousUsersEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppName?: InputMaybe<Scalars['String']>;
  authAppleClientId?: InputMaybe<Scalars['String']>;
  authAppleEnabled?: InputMaybe<Scalars['Boolean']>;
  authAppleKeyId?: InputMaybe<Scalars['String']>;
  authApplePrivateKey?: InputMaybe<Scalars['String']>;
  authAppleScope?: InputMaybe<Scalars['String']>;
  authAppleTeamId?: InputMaybe<Scalars['String']>;
  authClientUrl?: InputMaybe<Scalars['String']>;
  authDisableNewUsers?: InputMaybe<Scalars['Boolean']>;
  authDiscordClientId?: InputMaybe<Scalars['String']>;
  authDiscordClientSecret?: InputMaybe<Scalars['String']>;
  authDiscordEnabled?: InputMaybe<Scalars['Boolean']>;
  authDiscordScope?: InputMaybe<Scalars['String']>;
  authEmailPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authEmailSigninEmailVerifiedRequired?: InputMaybe<Scalars['Boolean']>;
  authEmailTemplateFetchUrl?: InputMaybe<Scalars['String']>;
  authEmailsEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookClientId?: InputMaybe<Scalars['String']>;
  authFacebookClientSecret?: InputMaybe<Scalars['String']>;
  authFacebookEnabled?: InputMaybe<Scalars['Boolean']>;
  authFacebookProfileFields?: InputMaybe<Scalars['String']>;
  authFacebookScope?: InputMaybe<Scalars['String']>;
  authGithubClientId?: InputMaybe<Scalars['String']>;
  authGithubClientSecret?: InputMaybe<Scalars['String']>;
  authGithubEnabled?: InputMaybe<Scalars['Boolean']>;
  authGithubScope?: InputMaybe<Scalars['String']>;
  authGoogleClientId?: InputMaybe<Scalars['String']>;
  authGoogleClientSecret?: InputMaybe<Scalars['String']>;
  authGoogleEnabled?: InputMaybe<Scalars['Boolean']>;
  authGoogleScope?: InputMaybe<Scalars['String']>;
  authGravatarDefault?: InputMaybe<Scalars['String']>;
  authGravatarEnabled?: InputMaybe<Scalars['Boolean']>;
  authGravatarRating?: InputMaybe<Scalars['String']>;
  authJwtCustomClaims?: InputMaybe<Scalars['jsonb']>;
  authLinkedinClientId?: InputMaybe<Scalars['String']>;
  authLinkedinClientSecret?: InputMaybe<Scalars['String']>;
  authLinkedinEnabled?: InputMaybe<Scalars['Boolean']>;
  authLinkedinScope?: InputMaybe<Scalars['String']>;
  authLocaleDefault?: InputMaybe<Scalars['String']>;
  authLogLevel?: InputMaybe<Scalars['String']>;
  authMfaEnabled?: InputMaybe<Scalars['Boolean']>;
  authMfaTotpIssuer?: InputMaybe<Scalars['String']>;
  authPasswordHibpEnabled?: InputMaybe<Scalars['Boolean']>;
  authPasswordMinLength?: InputMaybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: InputMaybe<Scalars['Int']>;
  authSmsPasswordlessEnabled?: InputMaybe<Scalars['Boolean']>;
  authSmsTwilioAccountSid?: InputMaybe<Scalars['String']>;
  authSmsTwilioAuthToken?: InputMaybe<Scalars['String']>;
  authSmsTwilioFrom?: InputMaybe<Scalars['String']>;
  authSmsTwilioMessagingServiceId?: InputMaybe<Scalars['String']>;
  authSmtpHost?: InputMaybe<Scalars['String']>;
  authSmtpPass?: InputMaybe<Scalars['String']>;
  authSmtpPort?: InputMaybe<Scalars['Int']>;
  authSmtpSender?: InputMaybe<Scalars['String']>;
  authSmtpUser?: InputMaybe<Scalars['String']>;
  authSpotifyClientId?: InputMaybe<Scalars['String']>;
  authSpotifyClientSecret?: InputMaybe<Scalars['String']>;
  authSpotifyEnabled?: InputMaybe<Scalars['Boolean']>;
  authSpotifyScope?: InputMaybe<Scalars['String']>;
  authTwitchClientId?: InputMaybe<Scalars['String']>;
  authTwitchClientSecret?: InputMaybe<Scalars['String']>;
  authTwitchEnabled?: InputMaybe<Scalars['Boolean']>;
  authTwitchScope?: InputMaybe<Scalars['String']>;
  authTwitterConsumerKey?: InputMaybe<Scalars['String']>;
  authTwitterConsumerSecret?: InputMaybe<Scalars['String']>;
  authTwitterEnabled?: InputMaybe<Scalars['Boolean']>;
  authUserDefaultAllowedRoles?: InputMaybe<Scalars['String']>;
  authUserDefaultRole?: InputMaybe<Scalars['String']>;
  authUserSessionVariableFields?: InputMaybe<Scalars['String']>;
  authWebAuthnEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveClientId?: InputMaybe<Scalars['String']>;
  authWindowsLiveClientSecret?: InputMaybe<Scalars['String']>;
  authWindowsLiveEnabled?: InputMaybe<Scalars['Boolean']>;
  authWindowsLiveScope?: InputMaybe<Scalars['String']>;
  authWorkOsClientId?: InputMaybe<Scalars['String']>;
  authWorkOsClientSecret?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultConnection?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultDomain?: InputMaybe<Scalars['String']>;
  authWorkOsDefaultOrganization?: InputMaybe<Scalars['String']>;
  authWorkOsEnabled?: InputMaybe<Scalars['Boolean']>;
  autoUpdate?: InputMaybe<Scalars['Boolean']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  desiredState?: InputMaybe<Scalars['Int']>;
  emailTemplatesS3Key?: InputMaybe<Scalars['String']>;
  githubRepositoryId?: InputMaybe<Scalars['uuid']>;
  hasuraAuthVersion?: InputMaybe<Scalars['String']>;
  hasuraGraphqlAdminSecret?: InputMaybe<Scalars['String']>;
  hasuraGraphqlDatabaseUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlEnableConsole?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnableRemoteSchemaPermissions?: InputMaybe<Scalars['Boolean']>;
  hasuraGraphqlEnabledApis?: InputMaybe<Scalars['String']>;
  hasuraGraphqlGraphqlUrl?: InputMaybe<Scalars['String']>;
  hasuraGraphqlJwtSecret?: InputMaybe<Scalars['String']>;
  hasuraStorageVersion?: InputMaybe<Scalars['String']>;
  hasuraVersion?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isProvisioned?: InputMaybe<Scalars['Boolean']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
  name?: InputMaybe<Scalars['String']>;
  nhostBaseFolder?: InputMaybe<Scalars['String']>;
  /** whether or not this app is paused */
  paused?: InputMaybe<Scalars['Boolean']>;
  planId?: InputMaybe<Scalars['uuid']>;
  postgresDatabase?: InputMaybe<Scalars['String']>;
  /** postgres hostname and port in the format of hostname:port */
  postgresHost?: InputMaybe<Scalars['String']>;
  postgresPassword?: InputMaybe<Scalars['String']>;
  postgresPublicAccess?: InputMaybe<Scalars['Boolean']>;
  postgresSchemaMigrationPassword?: InputMaybe<Scalars['String']>;
  postgresSchemaMigrationUser?: InputMaybe<Scalars['String']>;
  postgresUser?: InputMaybe<Scalars['String']>;
  postgresVersion?: InputMaybe<Scalars['String']>;
  providersUpdated?: InputMaybe<Scalars['Boolean']>;
  regionId?: InputMaybe<Scalars['uuid']>;
  repositoryProductionBranch?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  stripeSubscriptionId?: InputMaybe<Scalars['String']>;
  subdomain?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  webhookSecret?: InputMaybe<Scalars['String']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate sum on columns */
export type Apps_Sum_Fields = {
  __typename?: 'apps_sum_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Int']>;
  authPasswordMinLength?: Maybe<Scalars['Int']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Int']>;
  authSmtpPort?: Maybe<Scalars['Int']>;
  desiredState?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "apps" */
export type Apps_Sum_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** update columns of table "apps" */
export enum Apps_Update_Column {
  /** column name */
  AuthSmtpAuthMethod = 'AuthSmtpAuthMethod',
  /** column name */
  AuthSmtpSecure = 'AuthSmtpSecure',
  /** column name */
  S3AccessKey = 'S3AccessKey',
  /** column name */
  S3Bucket = 'S3Bucket',
  /** column name */
  S3Endpoint = 'S3Endpoint',
  /** column name */
  S3SecretKey = 'S3SecretKey',
  /** column name */
  S3SslEnabled = 'S3SslEnabled',
  /** column name */
  StorageForceDownloadForContentTypes = 'StorageForceDownloadForContentTypes',
  /** column name */
  StorageLogLevel = 'StorageLogLevel',
  /** column name */
  StorageSwaggerEnabled = 'StorageSwaggerEnabled',
  /** column name */
  AuthAccessControlAllowedEmailDomains = 'authAccessControlAllowedEmailDomains',
  /** column name */
  AuthAccessControlAllowedEmails = 'authAccessControlAllowedEmails',
  /** column name */
  AuthAccessControlAllowedRedirectUrls = 'authAccessControlAllowedRedirectUrls',
  /** column name */
  AuthAccessControlBlockedEmailDomains = 'authAccessControlBlockedEmailDomains',
  /** column name */
  AuthAccessControlBlockedEmails = 'authAccessControlBlockedEmails',
  /** column name */
  AuthAccessTokenExpiresIn = 'authAccessTokenExpiresIn',
  /** column name */
  AuthAllowedLocales = 'authAllowedLocales',
  /** column name */
  AuthAnonymousUsersEnabled = 'authAnonymousUsersEnabled',
  /** column name */
  AuthAppName = 'authAppName',
  /** column name */
  AuthAppleClientId = 'authAppleClientId',
  /** column name */
  AuthAppleEnabled = 'authAppleEnabled',
  /** column name */
  AuthAppleKeyId = 'authAppleKeyId',
  /** column name */
  AuthApplePrivateKey = 'authApplePrivateKey',
  /** column name */
  AuthAppleScope = 'authAppleScope',
  /** column name */
  AuthAppleTeamId = 'authAppleTeamId',
  /** column name */
  AuthClientUrl = 'authClientUrl',
  /** column name */
  AuthDisableNewUsers = 'authDisableNewUsers',
  /** column name */
  AuthDiscordClientId = 'authDiscordClientId',
  /** column name */
  AuthDiscordClientSecret = 'authDiscordClientSecret',
  /** column name */
  AuthDiscordEnabled = 'authDiscordEnabled',
  /** column name */
  AuthDiscordScope = 'authDiscordScope',
  /** column name */
  AuthEmailPasswordlessEnabled = 'authEmailPasswordlessEnabled',
  /** column name */
  AuthEmailSigninEmailVerifiedRequired = 'authEmailSigninEmailVerifiedRequired',
  /** column name */
  AuthEmailTemplateFetchUrl = 'authEmailTemplateFetchUrl',
  /** column name */
  AuthEmailsEnabled = 'authEmailsEnabled',
  /** column name */
  AuthFacebookClientId = 'authFacebookClientId',
  /** column name */
  AuthFacebookClientSecret = 'authFacebookClientSecret',
  /** column name */
  AuthFacebookEnabled = 'authFacebookEnabled',
  /** column name */
  AuthFacebookProfileFields = 'authFacebookProfileFields',
  /** column name */
  AuthFacebookScope = 'authFacebookScope',
  /** column name */
  AuthGithubClientId = 'authGithubClientId',
  /** column name */
  AuthGithubClientSecret = 'authGithubClientSecret',
  /** column name */
  AuthGithubEnabled = 'authGithubEnabled',
  /** column name */
  AuthGithubScope = 'authGithubScope',
  /** column name */
  AuthGoogleClientId = 'authGoogleClientId',
  /** column name */
  AuthGoogleClientSecret = 'authGoogleClientSecret',
  /** column name */
  AuthGoogleEnabled = 'authGoogleEnabled',
  /** column name */
  AuthGoogleScope = 'authGoogleScope',
  /** column name */
  AuthGravatarDefault = 'authGravatarDefault',
  /** column name */
  AuthGravatarEnabled = 'authGravatarEnabled',
  /** column name */
  AuthGravatarRating = 'authGravatarRating',
  /** column name */
  AuthJwtCustomClaims = 'authJwtCustomClaims',
  /** column name */
  AuthLinkedinClientId = 'authLinkedinClientId',
  /** column name */
  AuthLinkedinClientSecret = 'authLinkedinClientSecret',
  /** column name */
  AuthLinkedinEnabled = 'authLinkedinEnabled',
  /** column name */
  AuthLinkedinScope = 'authLinkedinScope',
  /** column name */
  AuthLocaleDefault = 'authLocaleDefault',
  /** column name */
  AuthLogLevel = 'authLogLevel',
  /** column name */
  AuthMfaEnabled = 'authMfaEnabled',
  /** column name */
  AuthMfaTotpIssuer = 'authMfaTotpIssuer',
  /** column name */
  AuthPasswordHibpEnabled = 'authPasswordHibpEnabled',
  /** column name */
  AuthPasswordMinLength = 'authPasswordMinLength',
  /** column name */
  AuthRefreshTokenExpiresIn = 'authRefreshTokenExpiresIn',
  /** column name */
  AuthSmsPasswordlessEnabled = 'authSmsPasswordlessEnabled',
  /** column name */
  AuthSmsTwilioAccountSid = 'authSmsTwilioAccountSid',
  /** column name */
  AuthSmsTwilioAuthToken = 'authSmsTwilioAuthToken',
  /** column name */
  AuthSmsTwilioFrom = 'authSmsTwilioFrom',
  /** column name */
  AuthSmsTwilioMessagingServiceId = 'authSmsTwilioMessagingServiceId',
  /** column name */
  AuthSmtpHost = 'authSmtpHost',
  /** column name */
  AuthSmtpPass = 'authSmtpPass',
  /** column name */
  AuthSmtpPort = 'authSmtpPort',
  /** column name */
  AuthSmtpSender = 'authSmtpSender',
  /** column name */
  AuthSmtpUser = 'authSmtpUser',
  /** column name */
  AuthSpotifyClientId = 'authSpotifyClientId',
  /** column name */
  AuthSpotifyClientSecret = 'authSpotifyClientSecret',
  /** column name */
  AuthSpotifyEnabled = 'authSpotifyEnabled',
  /** column name */
  AuthSpotifyScope = 'authSpotifyScope',
  /** column name */
  AuthTwitchClientId = 'authTwitchClientId',
  /** column name */
  AuthTwitchClientSecret = 'authTwitchClientSecret',
  /** column name */
  AuthTwitchEnabled = 'authTwitchEnabled',
  /** column name */
  AuthTwitchScope = 'authTwitchScope',
  /** column name */
  AuthTwitterConsumerKey = 'authTwitterConsumerKey',
  /** column name */
  AuthTwitterConsumerSecret = 'authTwitterConsumerSecret',
  /** column name */
  AuthTwitterEnabled = 'authTwitterEnabled',
  /** column name */
  AuthUserDefaultAllowedRoles = 'authUserDefaultAllowedRoles',
  /** column name */
  AuthUserDefaultRole = 'authUserDefaultRole',
  /** column name */
  AuthUserSessionVariableFields = 'authUserSessionVariableFields',
  /** column name */
  AuthWebAuthnEnabled = 'authWebAuthnEnabled',
  /** column name */
  AuthWindowsLiveClientId = 'authWindowsLiveClientId',
  /** column name */
  AuthWindowsLiveClientSecret = 'authWindowsLiveClientSecret',
  /** column name */
  AuthWindowsLiveEnabled = 'authWindowsLiveEnabled',
  /** column name */
  AuthWindowsLiveScope = 'authWindowsLiveScope',
  /** column name */
  AuthWorkOsClientId = 'authWorkOsClientId',
  /** column name */
  AuthWorkOsClientSecret = 'authWorkOsClientSecret',
  /** column name */
  AuthWorkOsDefaultConnection = 'authWorkOsDefaultConnection',
  /** column name */
  AuthWorkOsDefaultDomain = 'authWorkOsDefaultDomain',
  /** column name */
  AuthWorkOsDefaultOrganization = 'authWorkOsDefaultOrganization',
  /** column name */
  AuthWorkOsEnabled = 'authWorkOsEnabled',
  /** column name */
  AutoUpdate = 'autoUpdate',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  DesiredState = 'desiredState',
  /** column name */
  EmailTemplatesS3Key = 'emailTemplatesS3Key',
  /** column name */
  GithubRepositoryId = 'githubRepositoryId',
  /** column name */
  HasuraAuthVersion = 'hasuraAuthVersion',
  /** column name */
  HasuraGraphqlAdminSecret = 'hasuraGraphqlAdminSecret',
  /** column name */
  HasuraGraphqlDatabaseUrl = 'hasuraGraphqlDatabaseUrl',
  /** column name */
  HasuraGraphqlEnableConsole = 'hasuraGraphqlEnableConsole',
  /** column name */
  HasuraGraphqlEnableRemoteSchemaPermissions = 'hasuraGraphqlEnableRemoteSchemaPermissions',
  /** column name */
  HasuraGraphqlEnabledApis = 'hasuraGraphqlEnabledApis',
  /** column name */
  HasuraGraphqlGraphqlUrl = 'hasuraGraphqlGraphqlUrl',
  /** column name */
  HasuraGraphqlJwtSecret = 'hasuraGraphqlJwtSecret',
  /** column name */
  HasuraStorageVersion = 'hasuraStorageVersion',
  /** column name */
  HasuraVersion = 'hasuraVersion',
  /** column name */
  Id = 'id',
  /** column name */
  IsProvisioned = 'isProvisioned',
  /** column name */
  MetadataFunctions = 'metadataFunctions',
  /** column name */
  Name = 'name',
  /** column name */
  NhostBaseFolder = 'nhostBaseFolder',
  /** column name */
  Paused = 'paused',
  /** column name */
  PlanId = 'planId',
  /** column name */
  PostgresDatabase = 'postgresDatabase',
  /** column name */
  PostgresHost = 'postgresHost',
  /** column name */
  PostgresPassword = 'postgresPassword',
  /** column name */
  PostgresPublicAccess = 'postgresPublicAccess',
  /** column name */
  PostgresSchemaMigrationPassword = 'postgresSchemaMigrationPassword',
  /** column name */
  PostgresSchemaMigrationUser = 'postgresSchemaMigrationUser',
  /** column name */
  PostgresUser = 'postgresUser',
  /** column name */
  PostgresVersion = 'postgresVersion',
  /** column name */
  ProvidersUpdated = 'providersUpdated',
  /** column name */
  RegionId = 'regionId',
  /** column name */
  RepositoryProductionBranch = 'repositoryProductionBranch',
  /** column name */
  Slug = 'slug',
  /** column name */
  StripeSubscriptionId = 'stripeSubscriptionId',
  /** column name */
  Subdomain = 'subdomain',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WebhookSecret = 'webhookSecret',
  /** column name */
  WorkspaceId = 'workspaceId'
}

export type Apps_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Apps_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Apps_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Apps_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Apps_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Apps_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Apps_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Apps_Set_Input>;
  where: Apps_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Apps_Var_Pop_Fields = {
  __typename?: 'apps_var_pop_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "apps" */
export type Apps_Var_Pop_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Apps_Var_Samp_Fields = {
  __typename?: 'apps_var_samp_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "apps" */
export type Apps_Var_Samp_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Apps_Variance_Fields = {
  __typename?: 'apps_variance_fields';
  authAccessTokenExpiresIn?: Maybe<Scalars['Float']>;
  authPasswordMinLength?: Maybe<Scalars['Float']>;
  authRefreshTokenExpiresIn?: Maybe<Scalars['Float']>;
  authSmtpPort?: Maybe<Scalars['Float']>;
  desiredState?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "apps" */
export type Apps_Variance_Order_By = {
  authAccessTokenExpiresIn?: InputMaybe<Order_By>;
  authPasswordMinLength?: InputMaybe<Order_By>;
  authRefreshTokenExpiresIn?: InputMaybe<Order_By>;
  authSmtpPort?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
};

/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthProviderRequests = {
  __typename?: 'authProviderRequests';
  id: Scalars['uuid'];
  options?: Maybe<Scalars['jsonb']>;
};


/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthProviderRequestsOptionsArgs = {
  path?: InputMaybe<Scalars['String']>;
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
  columns?: InputMaybe<Array<AuthProviderRequests_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type AuthProviderRequests_Append_Input = {
  options?: InputMaybe<Scalars['jsonb']>;
};

/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
export type AuthProviderRequests_Bool_Exp = {
  _and?: InputMaybe<Array<AuthProviderRequests_Bool_Exp>>;
  _not?: InputMaybe<AuthProviderRequests_Bool_Exp>;
  _or?: InputMaybe<Array<AuthProviderRequests_Bool_Exp>>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  options?: InputMaybe<Jsonb_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.provider_requests" */
export enum AuthProviderRequests_Constraint {
  /** unique or primary key constraint on columns "id" */
  ProviderRequestsPkey = 'provider_requests_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type AuthProviderRequests_Delete_At_Path_Input = {
  options?: InputMaybe<Array<Scalars['String']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type AuthProviderRequests_Delete_Elem_Input = {
  options?: InputMaybe<Scalars['Int']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type AuthProviderRequests_Delete_Key_Input = {
  options?: InputMaybe<Scalars['String']>;
};

/** input type for inserting data into table "auth.provider_requests" */
export type AuthProviderRequests_Insert_Input = {
  id?: InputMaybe<Scalars['uuid']>;
  options?: InputMaybe<Scalars['jsonb']>;
};

/** aggregate max on columns */
export type AuthProviderRequests_Max_Fields = {
  __typename?: 'authProviderRequests_max_fields';
  id?: Maybe<Scalars['uuid']>;
};

/** aggregate min on columns */
export type AuthProviderRequests_Min_Fields = {
  __typename?: 'authProviderRequests_min_fields';
  id?: Maybe<Scalars['uuid']>;
};

/** response of any mutation on the table "auth.provider_requests" */
export type AuthProviderRequests_Mutation_Response = {
  __typename?: 'authProviderRequests_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthProviderRequests>;
};

/** on_conflict condition type for table "auth.provider_requests" */
export type AuthProviderRequests_On_Conflict = {
  constraint: AuthProviderRequests_Constraint;
  update_columns?: Array<AuthProviderRequests_Update_Column>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.provider_requests". */
export type AuthProviderRequests_Order_By = {
  id?: InputMaybe<Order_By>;
  options?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.provider_requests */
export type AuthProviderRequests_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type AuthProviderRequests_Prepend_Input = {
  options?: InputMaybe<Scalars['jsonb']>;
};

/** select columns of table "auth.provider_requests" */
export enum AuthProviderRequests_Select_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Options = 'options'
}

/** input type for updating data in table "auth.provider_requests" */
export type AuthProviderRequests_Set_Input = {
  id?: InputMaybe<Scalars['uuid']>;
  options?: InputMaybe<Scalars['jsonb']>;
};

/** Streaming cursor of the table "authProviderRequests" */
export type AuthProviderRequests_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthProviderRequests_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthProviderRequests_Stream_Cursor_Value_Input = {
  id?: InputMaybe<Scalars['uuid']>;
  options?: InputMaybe<Scalars['jsonb']>;
};

/** update columns of table "auth.provider_requests" */
export enum AuthProviderRequests_Update_Column {
  /** column name */
  Id = 'id',
  /** column name */
  Options = 'options'
}

export type AuthProviderRequests_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<AuthProviderRequests_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<AuthProviderRequests_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<AuthProviderRequests_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<AuthProviderRequests_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<AuthProviderRequests_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthProviderRequests_Set_Input>;
  where: AuthProviderRequests_Bool_Exp;
};

/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthProviders = {
  __typename?: 'authProviders';
  id: Scalars['String'];
  /** An array relationship */
  userProviders: Array<AuthUserProviders>;
  /** An aggregate relationship */
  userProviders_aggregate: AuthUserProviders_Aggregate;
};


/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthProvidersUserProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthProvidersUserProviders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
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
  columns?: InputMaybe<Array<AuthProviders_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
export type AuthProviders_Bool_Exp = {
  _and?: InputMaybe<Array<AuthProviders_Bool_Exp>>;
  _not?: InputMaybe<AuthProviders_Bool_Exp>;
  _or?: InputMaybe<Array<AuthProviders_Bool_Exp>>;
  id?: InputMaybe<String_Comparison_Exp>;
  userProviders?: InputMaybe<AuthUserProviders_Bool_Exp>;
  userProviders_aggregate?: InputMaybe<AuthUserProviders_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.providers" */
export enum AuthProviders_Constraint {
  /** unique or primary key constraint on columns "id" */
  ProvidersPkey = 'providers_pkey'
}

/** input type for inserting data into table "auth.providers" */
export type AuthProviders_Insert_Input = {
  id?: InputMaybe<Scalars['String']>;
  userProviders?: InputMaybe<AuthUserProviders_Arr_Rel_Insert_Input>;
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
  /** upsert condition */
  on_conflict?: InputMaybe<AuthProviders_On_Conflict>;
};

/** on_conflict condition type for table "auth.providers" */
export type AuthProviders_On_Conflict = {
  constraint: AuthProviders_Constraint;
  update_columns?: Array<AuthProviders_Update_Column>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.providers". */
export type AuthProviders_Order_By = {
  id?: InputMaybe<Order_By>;
  userProviders_aggregate?: InputMaybe<AuthUserProviders_Aggregate_Order_By>;
};

/** primary key columns input for table: auth.providers */
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
  id?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "authProviders" */
export type AuthProviders_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthProviders_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthProviders_Stream_Cursor_Value_Input = {
  id?: InputMaybe<Scalars['String']>;
};

/** update columns of table "auth.providers" */
export enum AuthProviders_Update_Column {
  /** column name */
  Id = 'id'
}

export type AuthProviders_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthProviders_Set_Input>;
  where: AuthProviders_Bool_Exp;
};

/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
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

export type AuthRefreshTokens_Aggregate_Bool_Exp = {
  count?: InputMaybe<AuthRefreshTokens_Aggregate_Bool_Exp_Count>;
};

export type AuthRefreshTokens_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
  predicate: Int_Comparison_Exp;
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
  columns?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AuthRefreshTokens_Max_Order_By>;
  min?: InputMaybe<AuthRefreshTokens_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.refresh_tokens" */
export type AuthRefreshTokens_Arr_Rel_Insert_Input = {
  data: Array<AuthRefreshTokens_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<AuthRefreshTokens_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
export type AuthRefreshTokens_Bool_Exp = {
  _and?: InputMaybe<Array<AuthRefreshTokens_Bool_Exp>>;
  _not?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
  _or?: InputMaybe<Array<AuthRefreshTokens_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  expiresAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  refreshToken?: InputMaybe<Uuid_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.refresh_tokens" */
export enum AuthRefreshTokens_Constraint {
  /** unique or primary key constraint on columns "refresh_token" */
  RefreshTokensPkey = 'refresh_tokens_pkey'
}

/** input type for inserting data into table "auth.refresh_tokens" */
export type AuthRefreshTokens_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  expiresAt?: InputMaybe<Scalars['timestamptz']>;
  refreshToken?: InputMaybe<Scalars['uuid']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
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
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
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
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "auth.refresh_tokens" */
export type AuthRefreshTokens_Mutation_Response = {
  __typename?: 'authRefreshTokens_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthRefreshTokens>;
};

/** on_conflict condition type for table "auth.refresh_tokens" */
export type AuthRefreshTokens_On_Conflict = {
  constraint: AuthRefreshTokens_Constraint;
  update_columns?: Array<AuthRefreshTokens_Update_Column>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.refresh_tokens". */
export type AuthRefreshTokens_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.refresh_tokens */
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
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  expiresAt?: InputMaybe<Scalars['timestamptz']>;
  refreshToken?: InputMaybe<Scalars['uuid']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "authRefreshTokens" */
export type AuthRefreshTokens_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthRefreshTokens_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthRefreshTokens_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  expiresAt?: InputMaybe<Scalars['timestamptz']>;
  refreshToken?: InputMaybe<Scalars['uuid']>;
  userId?: InputMaybe<Scalars['uuid']>;
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

export type AuthRefreshTokens_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthRefreshTokens_Set_Input>;
  where: AuthRefreshTokens_Bool_Exp;
};

/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
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


/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRolesUserRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRolesUserRoles_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRolesUsersByDefaultRoleArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRolesUsersByDefaultRole_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
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
  columns?: InputMaybe<Array<AuthRoles_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
export type AuthRoles_Bool_Exp = {
  _and?: InputMaybe<Array<AuthRoles_Bool_Exp>>;
  _not?: InputMaybe<AuthRoles_Bool_Exp>;
  _or?: InputMaybe<Array<AuthRoles_Bool_Exp>>;
  role?: InputMaybe<String_Comparison_Exp>;
  userRoles?: InputMaybe<AuthUserRoles_Bool_Exp>;
  userRoles_aggregate?: InputMaybe<AuthUserRoles_Aggregate_Bool_Exp>;
  usersByDefaultRole?: InputMaybe<Users_Bool_Exp>;
  usersByDefaultRole_aggregate?: InputMaybe<Users_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.roles" */
export enum AuthRoles_Constraint {
  /** unique or primary key constraint on columns "role" */
  RolesPkey = 'roles_pkey'
}

/** input type for inserting data into table "auth.roles" */
export type AuthRoles_Insert_Input = {
  role?: InputMaybe<Scalars['String']>;
  userRoles?: InputMaybe<AuthUserRoles_Arr_Rel_Insert_Input>;
  usersByDefaultRole?: InputMaybe<Users_Arr_Rel_Insert_Input>;
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
  /** upsert condition */
  on_conflict?: InputMaybe<AuthRoles_On_Conflict>;
};

/** on_conflict condition type for table "auth.roles" */
export type AuthRoles_On_Conflict = {
  constraint: AuthRoles_Constraint;
  update_columns?: Array<AuthRoles_Update_Column>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.roles". */
export type AuthRoles_Order_By = {
  role?: InputMaybe<Order_By>;
  userRoles_aggregate?: InputMaybe<AuthUserRoles_Aggregate_Order_By>;
  usersByDefaultRole_aggregate?: InputMaybe<Users_Aggregate_Order_By>;
};

/** primary key columns input for table: auth.roles */
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
  role?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "authRoles" */
export type AuthRoles_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthRoles_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthRoles_Stream_Cursor_Value_Input = {
  role?: InputMaybe<Scalars['String']>;
};

/** update columns of table "auth.roles" */
export enum AuthRoles_Update_Column {
  /** column name */
  Role = 'role'
}

export type AuthRoles_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthRoles_Set_Input>;
  where: AuthRoles_Bool_Exp;
};

/** Active providers for a given user. Don't modify its structure as Hasura Auth relies on it to function properly. */
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

export type AuthUserProviders_Aggregate_Bool_Exp = {
  count?: InputMaybe<AuthUserProviders_Aggregate_Bool_Exp_Count>;
};

export type AuthUserProviders_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<AuthUserProviders_Bool_Exp>;
  predicate: Int_Comparison_Exp;
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
  columns?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_providers" */
export type AuthUserProviders_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AuthUserProviders_Max_Order_By>;
  min?: InputMaybe<AuthUserProviders_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.user_providers" */
export type AuthUserProviders_Arr_Rel_Insert_Input = {
  data: Array<AuthUserProviders_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<AuthUserProviders_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
export type AuthUserProviders_Bool_Exp = {
  _and?: InputMaybe<Array<AuthUserProviders_Bool_Exp>>;
  _not?: InputMaybe<AuthUserProviders_Bool_Exp>;
  _or?: InputMaybe<Array<AuthUserProviders_Bool_Exp>>;
  accessToken?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  provider?: InputMaybe<AuthProviders_Bool_Exp>;
  providerId?: InputMaybe<String_Comparison_Exp>;
  providerUserId?: InputMaybe<String_Comparison_Exp>;
  refreshToken?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.user_providers" */
export enum AuthUserProviders_Constraint {
  /** unique or primary key constraint on columns "id" */
  UserProvidersPkey = 'user_providers_pkey',
  /** unique or primary key constraint on columns "provider_id", "provider_user_id" */
  UserProvidersProviderIdProviderUserIdKey = 'user_providers_provider_id_provider_user_id_key',
  /** unique or primary key constraint on columns "provider_id", "user_id" */
  UserProvidersUserIdProviderIdKey = 'user_providers_user_id_provider_id_key'
}

/** input type for inserting data into table "auth.user_providers" */
export type AuthUserProviders_Insert_Input = {
  accessToken?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  provider?: InputMaybe<AuthProviders_Obj_Rel_Insert_Input>;
  providerId?: InputMaybe<Scalars['String']>;
  providerUserId?: InputMaybe<Scalars['String']>;
  refreshToken?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
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
  accessToken?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  providerId?: InputMaybe<Order_By>;
  providerUserId?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
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
  accessToken?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  providerId?: InputMaybe<Order_By>;
  providerUserId?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "auth.user_providers" */
export type AuthUserProviders_Mutation_Response = {
  __typename?: 'authUserProviders_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserProviders>;
};

/** on_conflict condition type for table "auth.user_providers" */
export type AuthUserProviders_On_Conflict = {
  constraint: AuthUserProviders_Constraint;
  update_columns?: Array<AuthUserProviders_Update_Column>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.user_providers". */
export type AuthUserProviders_Order_By = {
  accessToken?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  provider?: InputMaybe<AuthProviders_Order_By>;
  providerId?: InputMaybe<Order_By>;
  providerUserId?: InputMaybe<Order_By>;
  refreshToken?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.user_providers */
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
  accessToken?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  providerId?: InputMaybe<Scalars['String']>;
  providerUserId?: InputMaybe<Scalars['String']>;
  refreshToken?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "authUserProviders" */
export type AuthUserProviders_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthUserProviders_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthUserProviders_Stream_Cursor_Value_Input = {
  accessToken?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  providerId?: InputMaybe<Scalars['String']>;
  providerUserId?: InputMaybe<Scalars['String']>;
  refreshToken?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
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

export type AuthUserProviders_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthUserProviders_Set_Input>;
  where: AuthUserProviders_Bool_Exp;
};

/** Roles of users. Don't modify its structure as Hasura Auth relies on it to function properly. */
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

export type AuthUserRoles_Aggregate_Bool_Exp = {
  count?: InputMaybe<AuthUserRoles_Aggregate_Bool_Exp_Count>;
};

export type AuthUserRoles_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<AuthUserRoles_Bool_Exp>;
  predicate: Int_Comparison_Exp;
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
  columns?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_roles" */
export type AuthUserRoles_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AuthUserRoles_Max_Order_By>;
  min?: InputMaybe<AuthUserRoles_Min_Order_By>;
};

/** input type for inserting array relation for remote table "auth.user_roles" */
export type AuthUserRoles_Arr_Rel_Insert_Input = {
  data: Array<AuthUserRoles_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<AuthUserRoles_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
export type AuthUserRoles_Bool_Exp = {
  _and?: InputMaybe<Array<AuthUserRoles_Bool_Exp>>;
  _not?: InputMaybe<AuthUserRoles_Bool_Exp>;
  _or?: InputMaybe<Array<AuthUserRoles_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  role?: InputMaybe<String_Comparison_Exp>;
  roleByRole?: InputMaybe<AuthRoles_Bool_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.user_roles" */
export enum AuthUserRoles_Constraint {
  /** unique or primary key constraint on columns "id" */
  UserRolesPkey = 'user_roles_pkey',
  /** unique or primary key constraint on columns "user_id", "role" */
  UserRolesUserIdRoleKey = 'user_roles_user_id_role_key'
}

/** input type for inserting data into table "auth.user_roles" */
export type AuthUserRoles_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  role?: InputMaybe<Scalars['String']>;
  roleByRole?: InputMaybe<AuthRoles_Obj_Rel_Insert_Input>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
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
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  role?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
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
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  role?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "auth.user_roles" */
export type AuthUserRoles_Mutation_Response = {
  __typename?: 'authUserRoles_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserRoles>;
};

/** on_conflict condition type for table "auth.user_roles" */
export type AuthUserRoles_On_Conflict = {
  constraint: AuthUserRoles_Constraint;
  update_columns?: Array<AuthUserRoles_Update_Column>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.user_roles". */
export type AuthUserRoles_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  role?: InputMaybe<Order_By>;
  roleByRole?: InputMaybe<AuthRoles_Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.user_roles */
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
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  role?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "authUserRoles" */
export type AuthUserRoles_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthUserRoles_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthUserRoles_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  role?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['uuid']>;
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

export type AuthUserRoles_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthUserRoles_Set_Input>;
  where: AuthUserRoles_Bool_Exp;
};

/** User webauthn security keys. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthUserSecurityKeys = {
  __typename?: 'authUserSecurityKeys';
  counter: Scalars['bigint'];
  credentialId: Scalars['String'];
  credentialPublicKey?: Maybe<Scalars['bytea']>;
  id: Scalars['uuid'];
  nickname?: Maybe<Scalars['String']>;
  transports: Scalars['String'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "auth.user_security_keys" */
export type AuthUserSecurityKeys_Aggregate = {
  __typename?: 'authUserSecurityKeys_aggregate';
  aggregate?: Maybe<AuthUserSecurityKeys_Aggregate_Fields>;
  nodes: Array<AuthUserSecurityKeys>;
};

export type AuthUserSecurityKeys_Aggregate_Bool_Exp = {
  count?: InputMaybe<AuthUserSecurityKeys_Aggregate_Bool_Exp_Count>;
};

export type AuthUserSecurityKeys_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "auth.user_security_keys" */
export type AuthUserSecurityKeys_Aggregate_Fields = {
  __typename?: 'authUserSecurityKeys_aggregate_fields';
  avg?: Maybe<AuthUserSecurityKeys_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<AuthUserSecurityKeys_Max_Fields>;
  min?: Maybe<AuthUserSecurityKeys_Min_Fields>;
  stddev?: Maybe<AuthUserSecurityKeys_Stddev_Fields>;
  stddev_pop?: Maybe<AuthUserSecurityKeys_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<AuthUserSecurityKeys_Stddev_Samp_Fields>;
  sum?: Maybe<AuthUserSecurityKeys_Sum_Fields>;
  var_pop?: Maybe<AuthUserSecurityKeys_Var_Pop_Fields>;
  var_samp?: Maybe<AuthUserSecurityKeys_Var_Samp_Fields>;
  variance?: Maybe<AuthUserSecurityKeys_Variance_Fields>;
};


/** aggregate fields of "auth.user_security_keys" */
export type AuthUserSecurityKeys_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Aggregate_Order_By = {
  avg?: InputMaybe<AuthUserSecurityKeys_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AuthUserSecurityKeys_Max_Order_By>;
  min?: InputMaybe<AuthUserSecurityKeys_Min_Order_By>;
  stddev?: InputMaybe<AuthUserSecurityKeys_Stddev_Order_By>;
  stddev_pop?: InputMaybe<AuthUserSecurityKeys_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<AuthUserSecurityKeys_Stddev_Samp_Order_By>;
  sum?: InputMaybe<AuthUserSecurityKeys_Sum_Order_By>;
  var_pop?: InputMaybe<AuthUserSecurityKeys_Var_Pop_Order_By>;
  var_samp?: InputMaybe<AuthUserSecurityKeys_Var_Samp_Order_By>;
  variance?: InputMaybe<AuthUserSecurityKeys_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Arr_Rel_Insert_Input = {
  data: Array<AuthUserSecurityKeys_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<AuthUserSecurityKeys_On_Conflict>;
};

/** aggregate avg on columns */
export type AuthUserSecurityKeys_Avg_Fields = {
  __typename?: 'authUserSecurityKeys_avg_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Avg_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "auth.user_security_keys". All fields are combined with a logical 'AND'. */
export type AuthUserSecurityKeys_Bool_Exp = {
  _and?: InputMaybe<Array<AuthUserSecurityKeys_Bool_Exp>>;
  _not?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
  _or?: InputMaybe<Array<AuthUserSecurityKeys_Bool_Exp>>;
  counter?: InputMaybe<Bigint_Comparison_Exp>;
  credentialId?: InputMaybe<String_Comparison_Exp>;
  credentialPublicKey?: InputMaybe<Bytea_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  nickname?: InputMaybe<String_Comparison_Exp>;
  transports?: InputMaybe<String_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.user_security_keys" */
export enum AuthUserSecurityKeys_Constraint {
  /** unique or primary key constraint on columns "credential_id" */
  UserSecurityKeyCredentialIdKey = 'user_security_key_credential_id_key',
  /** unique or primary key constraint on columns "id" */
  UserSecurityKeysPkey = 'user_security_keys_pkey'
}

/** input type for incrementing numeric columns in table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Inc_Input = {
  counter?: InputMaybe<Scalars['bigint']>;
};

/** input type for inserting data into table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Insert_Input = {
  counter?: InputMaybe<Scalars['bigint']>;
  credentialId?: InputMaybe<Scalars['String']>;
  credentialPublicKey?: InputMaybe<Scalars['bytea']>;
  id?: InputMaybe<Scalars['uuid']>;
  nickname?: InputMaybe<Scalars['String']>;
  transports?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type AuthUserSecurityKeys_Max_Fields = {
  __typename?: 'authUserSecurityKeys_max_fields';
  counter?: Maybe<Scalars['bigint']>;
  credentialId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  nickname?: Maybe<Scalars['String']>;
  transports?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Max_Order_By = {
  counter?: InputMaybe<Order_By>;
  credentialId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nickname?: InputMaybe<Order_By>;
  transports?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type AuthUserSecurityKeys_Min_Fields = {
  __typename?: 'authUserSecurityKeys_min_fields';
  counter?: Maybe<Scalars['bigint']>;
  credentialId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  nickname?: Maybe<Scalars['String']>;
  transports?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Min_Order_By = {
  counter?: InputMaybe<Order_By>;
  credentialId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nickname?: InputMaybe<Order_By>;
  transports?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Mutation_Response = {
  __typename?: 'authUserSecurityKeys_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthUserSecurityKeys>;
};

/** on_conflict condition type for table "auth.user_security_keys" */
export type AuthUserSecurityKeys_On_Conflict = {
  constraint: AuthUserSecurityKeys_Constraint;
  update_columns?: Array<AuthUserSecurityKeys_Update_Column>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.user_security_keys". */
export type AuthUserSecurityKeys_Order_By = {
  counter?: InputMaybe<Order_By>;
  credentialId?: InputMaybe<Order_By>;
  credentialPublicKey?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nickname?: InputMaybe<Order_By>;
  transports?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.user_security_keys */
export type AuthUserSecurityKeys_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "auth.user_security_keys" */
export enum AuthUserSecurityKeys_Select_Column {
  /** column name */
  Counter = 'counter',
  /** column name */
  CredentialId = 'credentialId',
  /** column name */
  CredentialPublicKey = 'credentialPublicKey',
  /** column name */
  Id = 'id',
  /** column name */
  Nickname = 'nickname',
  /** column name */
  Transports = 'transports',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Set_Input = {
  counter?: InputMaybe<Scalars['bigint']>;
  credentialId?: InputMaybe<Scalars['String']>;
  credentialPublicKey?: InputMaybe<Scalars['bytea']>;
  id?: InputMaybe<Scalars['uuid']>;
  nickname?: InputMaybe<Scalars['String']>;
  transports?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate stddev on columns */
export type AuthUserSecurityKeys_Stddev_Fields = {
  __typename?: 'authUserSecurityKeys_stddev_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Stddev_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type AuthUserSecurityKeys_Stddev_Pop_Fields = {
  __typename?: 'authUserSecurityKeys_stddev_pop_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Stddev_Pop_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type AuthUserSecurityKeys_Stddev_Samp_Fields = {
  __typename?: 'authUserSecurityKeys_stddev_samp_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Stddev_Samp_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "authUserSecurityKeys" */
export type AuthUserSecurityKeys_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthUserSecurityKeys_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthUserSecurityKeys_Stream_Cursor_Value_Input = {
  counter?: InputMaybe<Scalars['bigint']>;
  credentialId?: InputMaybe<Scalars['String']>;
  credentialPublicKey?: InputMaybe<Scalars['bytea']>;
  id?: InputMaybe<Scalars['uuid']>;
  nickname?: InputMaybe<Scalars['String']>;
  transports?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate sum on columns */
export type AuthUserSecurityKeys_Sum_Fields = {
  __typename?: 'authUserSecurityKeys_sum_fields';
  counter?: Maybe<Scalars['bigint']>;
};

/** order by sum() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Sum_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** update columns of table "auth.user_security_keys" */
export enum AuthUserSecurityKeys_Update_Column {
  /** column name */
  Counter = 'counter',
  /** column name */
  CredentialId = 'credentialId',
  /** column name */
  CredentialPublicKey = 'credentialPublicKey',
  /** column name */
  Id = 'id',
  /** column name */
  Nickname = 'nickname',
  /** column name */
  Transports = 'transports',
  /** column name */
  UserId = 'userId'
}

export type AuthUserSecurityKeys_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<AuthUserSecurityKeys_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<AuthUserSecurityKeys_Set_Input>;
  where: AuthUserSecurityKeys_Bool_Exp;
};

/** aggregate var_pop on columns */
export type AuthUserSecurityKeys_Var_Pop_Fields = {
  __typename?: 'authUserSecurityKeys_var_pop_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Var_Pop_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type AuthUserSecurityKeys_Var_Samp_Fields = {
  __typename?: 'authUserSecurityKeys_var_samp_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Var_Samp_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type AuthUserSecurityKeys_Variance_Fields = {
  __typename?: 'authUserSecurityKeys_variance_fields';
  counter?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "auth.user_security_keys" */
export type AuthUserSecurityKeys_Variance_Order_By = {
  counter?: InputMaybe<Order_By>;
};

/** Internal table for tracking migrations. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type Auth_Migrations = {
  __typename?: 'auth_migrations';
  executed_at?: Maybe<Scalars['timestamp']>;
  hash: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
};

/** aggregated selection of "auth.migrations" */
export type Auth_Migrations_Aggregate = {
  __typename?: 'auth_migrations_aggregate';
  aggregate?: Maybe<Auth_Migrations_Aggregate_Fields>;
  nodes: Array<Auth_Migrations>;
};

/** aggregate fields of "auth.migrations" */
export type Auth_Migrations_Aggregate_Fields = {
  __typename?: 'auth_migrations_aggregate_fields';
  avg?: Maybe<Auth_Migrations_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Auth_Migrations_Max_Fields>;
  min?: Maybe<Auth_Migrations_Min_Fields>;
  stddev?: Maybe<Auth_Migrations_Stddev_Fields>;
  stddev_pop?: Maybe<Auth_Migrations_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Auth_Migrations_Stddev_Samp_Fields>;
  sum?: Maybe<Auth_Migrations_Sum_Fields>;
  var_pop?: Maybe<Auth_Migrations_Var_Pop_Fields>;
  var_samp?: Maybe<Auth_Migrations_Var_Samp_Fields>;
  variance?: Maybe<Auth_Migrations_Variance_Fields>;
};


/** aggregate fields of "auth.migrations" */
export type Auth_Migrations_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Auth_Migrations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** aggregate avg on columns */
export type Auth_Migrations_Avg_Fields = {
  __typename?: 'auth_migrations_avg_fields';
  id?: Maybe<Scalars['Float']>;
};

/** Boolean expression to filter rows from the table "auth.migrations". All fields are combined with a logical 'AND'. */
export type Auth_Migrations_Bool_Exp = {
  _and?: InputMaybe<Array<Auth_Migrations_Bool_Exp>>;
  _not?: InputMaybe<Auth_Migrations_Bool_Exp>;
  _or?: InputMaybe<Array<Auth_Migrations_Bool_Exp>>;
  executed_at?: InputMaybe<Timestamp_Comparison_Exp>;
  hash?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "auth.migrations" */
export enum Auth_Migrations_Constraint {
  /** unique or primary key constraint on columns "name" */
  MigrationsNameKey = 'migrations_name_key',
  /** unique or primary key constraint on columns "id" */
  MigrationsPkey = 'migrations_pkey'
}

/** input type for incrementing numeric columns in table "auth.migrations" */
export type Auth_Migrations_Inc_Input = {
  id?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "auth.migrations" */
export type Auth_Migrations_Insert_Input = {
  executed_at?: InputMaybe<Scalars['timestamp']>;
  hash?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type Auth_Migrations_Max_Fields = {
  __typename?: 'auth_migrations_max_fields';
  executed_at?: Maybe<Scalars['timestamp']>;
  hash?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type Auth_Migrations_Min_Fields = {
  __typename?: 'auth_migrations_min_fields';
  executed_at?: Maybe<Scalars['timestamp']>;
  hash?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "auth.migrations" */
export type Auth_Migrations_Mutation_Response = {
  __typename?: 'auth_migrations_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Auth_Migrations>;
};

/** on_conflict condition type for table "auth.migrations" */
export type Auth_Migrations_On_Conflict = {
  constraint: Auth_Migrations_Constraint;
  update_columns?: Array<Auth_Migrations_Update_Column>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.migrations". */
export type Auth_Migrations_Order_By = {
  executed_at?: InputMaybe<Order_By>;
  hash?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
};

/** primary key columns input for table: auth.migrations */
export type Auth_Migrations_Pk_Columns_Input = {
  id: Scalars['Int'];
};

/** select columns of table "auth.migrations" */
export enum Auth_Migrations_Select_Column {
  /** column name */
  ExecutedAt = 'executed_at',
  /** column name */
  Hash = 'hash',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "auth.migrations" */
export type Auth_Migrations_Set_Input = {
  executed_at?: InputMaybe<Scalars['timestamp']>;
  hash?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate stddev on columns */
export type Auth_Migrations_Stddev_Fields = {
  __typename?: 'auth_migrations_stddev_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_pop on columns */
export type Auth_Migrations_Stddev_Pop_Fields = {
  __typename?: 'auth_migrations_stddev_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_samp on columns */
export type Auth_Migrations_Stddev_Samp_Fields = {
  __typename?: 'auth_migrations_stddev_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** Streaming cursor of the table "auth_migrations" */
export type Auth_Migrations_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Auth_Migrations_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Auth_Migrations_Stream_Cursor_Value_Input = {
  executed_at?: InputMaybe<Scalars['timestamp']>;
  hash?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate sum on columns */
export type Auth_Migrations_Sum_Fields = {
  __typename?: 'auth_migrations_sum_fields';
  id?: Maybe<Scalars['Int']>;
};

/** update columns of table "auth.migrations" */
export enum Auth_Migrations_Update_Column {
  /** column name */
  ExecutedAt = 'executed_at',
  /** column name */
  Hash = 'hash',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name'
}

export type Auth_Migrations_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Auth_Migrations_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Auth_Migrations_Set_Input>;
  where: Auth_Migrations_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Auth_Migrations_Var_Pop_Fields = {
  __typename?: 'auth_migrations_var_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate var_samp on columns */
export type Auth_Migrations_Var_Samp_Fields = {
  __typename?: 'auth_migrations_var_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** aggregate variance on columns */
export type Auth_Migrations_Variance_Fields = {
  __typename?: 'auth_migrations_variance_fields';
  id?: Maybe<Scalars['Float']>;
};

/** columns and relationships of "backups" */
export type Backups = {
  __typename?: 'backups';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  completedAt?: Maybe<Scalars['timestamptz']>;
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  size: Scalars['bigint'];
};

/** aggregated selection of "backups" */
export type Backups_Aggregate = {
  __typename?: 'backups_aggregate';
  aggregate?: Maybe<Backups_Aggregate_Fields>;
  nodes: Array<Backups>;
};

export type Backups_Aggregate_Bool_Exp = {
  count?: InputMaybe<Backups_Aggregate_Bool_Exp_Count>;
};

export type Backups_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Backups_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Backups_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "backups" */
export type Backups_Aggregate_Fields = {
  __typename?: 'backups_aggregate_fields';
  avg?: Maybe<Backups_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Backups_Max_Fields>;
  min?: Maybe<Backups_Min_Fields>;
  stddev?: Maybe<Backups_Stddev_Fields>;
  stddev_pop?: Maybe<Backups_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Backups_Stddev_Samp_Fields>;
  sum?: Maybe<Backups_Sum_Fields>;
  var_pop?: Maybe<Backups_Var_Pop_Fields>;
  var_samp?: Maybe<Backups_Var_Samp_Fields>;
  variance?: Maybe<Backups_Variance_Fields>;
};


/** aggregate fields of "backups" */
export type Backups_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Backups_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "backups" */
export type Backups_Aggregate_Order_By = {
  avg?: InputMaybe<Backups_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Backups_Max_Order_By>;
  min?: InputMaybe<Backups_Min_Order_By>;
  stddev?: InputMaybe<Backups_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Backups_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Backups_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Backups_Sum_Order_By>;
  var_pop?: InputMaybe<Backups_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Backups_Var_Samp_Order_By>;
  variance?: InputMaybe<Backups_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "backups" */
export type Backups_Arr_Rel_Insert_Input = {
  data: Array<Backups_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Backups_On_Conflict>;
};

/** aggregate avg on columns */
export type Backups_Avg_Fields = {
  __typename?: 'backups_avg_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "backups" */
export type Backups_Avg_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "backups". All fields are combined with a logical 'AND'. */
export type Backups_Bool_Exp = {
  _and?: InputMaybe<Array<Backups_Bool_Exp>>;
  _not?: InputMaybe<Backups_Bool_Exp>;
  _or?: InputMaybe<Array<Backups_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  completedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  size?: InputMaybe<Bigint_Comparison_Exp>;
};

/** unique or primary key constraints on table "backups" */
export enum Backups_Constraint {
  /** unique or primary key constraint on columns "id" */
  BackupsPkey = 'backups_pkey'
}

/** input type for incrementing numeric columns in table "backups" */
export type Backups_Inc_Input = {
  size?: InputMaybe<Scalars['bigint']>;
};

/** input type for inserting data into table "backups" */
export type Backups_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  completedAt?: InputMaybe<Scalars['timestamptz']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  size?: InputMaybe<Scalars['bigint']>;
};

/** aggregate max on columns */
export type Backups_Max_Fields = {
  __typename?: 'backups_max_fields';
  appId?: Maybe<Scalars['uuid']>;
  completedAt?: Maybe<Scalars['timestamptz']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  size?: Maybe<Scalars['bigint']>;
};

/** order by max() on columns of table "backups" */
export type Backups_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Backups_Min_Fields = {
  __typename?: 'backups_min_fields';
  appId?: Maybe<Scalars['uuid']>;
  completedAt?: Maybe<Scalars['timestamptz']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  size?: Maybe<Scalars['bigint']>;
};

/** order by min() on columns of table "backups" */
export type Backups_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "backups" */
export type Backups_Mutation_Response = {
  __typename?: 'backups_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Backups>;
};

/** on_conflict condition type for table "backups" */
export type Backups_On_Conflict = {
  constraint: Backups_Constraint;
  update_columns?: Array<Backups_Update_Column>;
  where?: InputMaybe<Backups_Bool_Exp>;
};

/** Ordering options when selecting data from "backups". */
export type Backups_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** primary key columns input for table: backups */
export type Backups_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "backups" */
export enum Backups_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CompletedAt = 'completedAt',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Size = 'size'
}

/** input type for updating data in table "backups" */
export type Backups_Set_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  completedAt?: InputMaybe<Scalars['timestamptz']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  size?: InputMaybe<Scalars['bigint']>;
};

/** aggregate stddev on columns */
export type Backups_Stddev_Fields = {
  __typename?: 'backups_stddev_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "backups" */
export type Backups_Stddev_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Backups_Stddev_Pop_Fields = {
  __typename?: 'backups_stddev_pop_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "backups" */
export type Backups_Stddev_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Backups_Stddev_Samp_Fields = {
  __typename?: 'backups_stddev_samp_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "backups" */
export type Backups_Stddev_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "backups" */
export type Backups_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Backups_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Backups_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  completedAt?: InputMaybe<Scalars['timestamptz']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  size?: InputMaybe<Scalars['bigint']>;
};

/** aggregate sum on columns */
export type Backups_Sum_Fields = {
  __typename?: 'backups_sum_fields';
  size?: Maybe<Scalars['bigint']>;
};

/** order by sum() on columns of table "backups" */
export type Backups_Sum_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** update columns of table "backups" */
export enum Backups_Update_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CompletedAt = 'completedAt',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Size = 'size'
}

export type Backups_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Backups_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Backups_Set_Input>;
  where: Backups_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Backups_Var_Pop_Fields = {
  __typename?: 'backups_var_pop_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "backups" */
export type Backups_Var_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Backups_Var_Samp_Fields = {
  __typename?: 'backups_var_samp_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "backups" */
export type Backups_Var_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Backups_Variance_Fields = {
  __typename?: 'backups_variance_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "backups" */
export type Backups_Variance_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
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

/** Boolean expression to compare columns of type "bpchar". All fields are combined with logical 'AND'. */
export type Bpchar_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bpchar']>;
  _gt?: InputMaybe<Scalars['bpchar']>;
  _gte?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['bpchar']>;
  _in?: InputMaybe<Array<Scalars['bpchar']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['bpchar']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['bpchar']>;
  _lt?: InputMaybe<Scalars['bpchar']>;
  _lte?: InputMaybe<Scalars['bpchar']>;
  _neq?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['bpchar']>;
  _nin?: InputMaybe<Array<Scalars['bpchar']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['bpchar']>;
};

/** columns and relationships of "storage.buckets" */
export type Buckets = {
  __typename?: 'buckets';
  cacheControl?: Maybe<Scalars['String']>;
  createdAt: Scalars['timestamptz'];
  downloadExpiration: Scalars['Int'];
  /** An array relationship */
  files: Array<Files>;
  /** An aggregate relationship */
  files_aggregate: Files_Aggregate;
  id: Scalars['String'];
  maxUploadFileSize: Scalars['Int'];
  minUploadFileSize: Scalars['Int'];
  presignedUrlsEnabled: Scalars['Boolean'];
  updatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "storage.buckets" */
export type BucketsFilesArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


/** columns and relationships of "storage.buckets" */
export type BucketsFiles_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};

/** aggregated selection of "storage.buckets" */
export type Buckets_Aggregate = {
  __typename?: 'buckets_aggregate';
  aggregate?: Maybe<Buckets_Aggregate_Fields>;
  nodes: Array<Buckets>;
};

/** aggregate fields of "storage.buckets" */
export type Buckets_Aggregate_Fields = {
  __typename?: 'buckets_aggregate_fields';
  avg?: Maybe<Buckets_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Buckets_Max_Fields>;
  min?: Maybe<Buckets_Min_Fields>;
  stddev?: Maybe<Buckets_Stddev_Fields>;
  stddev_pop?: Maybe<Buckets_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Buckets_Stddev_Samp_Fields>;
  sum?: Maybe<Buckets_Sum_Fields>;
  var_pop?: Maybe<Buckets_Var_Pop_Fields>;
  var_samp?: Maybe<Buckets_Var_Samp_Fields>;
  variance?: Maybe<Buckets_Variance_Fields>;
};


/** aggregate fields of "storage.buckets" */
export type Buckets_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Buckets_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** aggregate avg on columns */
export type Buckets_Avg_Fields = {
  __typename?: 'buckets_avg_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** Boolean expression to filter rows from the table "storage.buckets". All fields are combined with a logical 'AND'. */
export type Buckets_Bool_Exp = {
  _and?: InputMaybe<Array<Buckets_Bool_Exp>>;
  _not?: InputMaybe<Buckets_Bool_Exp>;
  _or?: InputMaybe<Array<Buckets_Bool_Exp>>;
  cacheControl?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  downloadExpiration?: InputMaybe<Int_Comparison_Exp>;
  files?: InputMaybe<Files_Bool_Exp>;
  files_aggregate?: InputMaybe<Files_Aggregate_Bool_Exp>;
  id?: InputMaybe<String_Comparison_Exp>;
  maxUploadFileSize?: InputMaybe<Int_Comparison_Exp>;
  minUploadFileSize?: InputMaybe<Int_Comparison_Exp>;
  presignedUrlsEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "storage.buckets" */
export enum Buckets_Constraint {
  /** unique or primary key constraint on columns "id" */
  BucketsPkey = 'buckets_pkey'
}

/** input type for incrementing numeric columns in table "storage.buckets" */
export type Buckets_Inc_Input = {
  downloadExpiration?: InputMaybe<Scalars['Int']>;
  maxUploadFileSize?: InputMaybe<Scalars['Int']>;
  minUploadFileSize?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "storage.buckets" */
export type Buckets_Insert_Input = {
  cacheControl?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  downloadExpiration?: InputMaybe<Scalars['Int']>;
  files?: InputMaybe<Files_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['String']>;
  maxUploadFileSize?: InputMaybe<Scalars['Int']>;
  minUploadFileSize?: InputMaybe<Scalars['Int']>;
  presignedUrlsEnabled?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate max on columns */
export type Buckets_Max_Fields = {
  __typename?: 'buckets_max_fields';
  cacheControl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  downloadExpiration?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['String']>;
  maxUploadFileSize?: Maybe<Scalars['Int']>;
  minUploadFileSize?: Maybe<Scalars['Int']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** aggregate min on columns */
export type Buckets_Min_Fields = {
  __typename?: 'buckets_min_fields';
  cacheControl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  downloadExpiration?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['String']>;
  maxUploadFileSize?: Maybe<Scalars['Int']>;
  minUploadFileSize?: Maybe<Scalars['Int']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** response of any mutation on the table "storage.buckets" */
export type Buckets_Mutation_Response = {
  __typename?: 'buckets_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Buckets>;
};

/** input type for inserting object relation for remote table "storage.buckets" */
export type Buckets_Obj_Rel_Insert_Input = {
  data: Buckets_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Buckets_On_Conflict>;
};

/** on_conflict condition type for table "storage.buckets" */
export type Buckets_On_Conflict = {
  constraint: Buckets_Constraint;
  update_columns?: Array<Buckets_Update_Column>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};

/** Ordering options when selecting data from "storage.buckets". */
export type Buckets_Order_By = {
  cacheControl?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  downloadExpiration?: InputMaybe<Order_By>;
  files_aggregate?: InputMaybe<Files_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  maxUploadFileSize?: InputMaybe<Order_By>;
  minUploadFileSize?: InputMaybe<Order_By>;
  presignedUrlsEnabled?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: storage.buckets */
export type Buckets_Pk_Columns_Input = {
  id: Scalars['String'];
};

/** select columns of table "storage.buckets" */
export enum Buckets_Select_Column {
  /** column name */
  CacheControl = 'cacheControl',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DownloadExpiration = 'downloadExpiration',
  /** column name */
  Id = 'id',
  /** column name */
  MaxUploadFileSize = 'maxUploadFileSize',
  /** column name */
  MinUploadFileSize = 'minUploadFileSize',
  /** column name */
  PresignedUrlsEnabled = 'presignedUrlsEnabled',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "storage.buckets" */
export type Buckets_Set_Input = {
  cacheControl?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  downloadExpiration?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['String']>;
  maxUploadFileSize?: InputMaybe<Scalars['Int']>;
  minUploadFileSize?: InputMaybe<Scalars['Int']>;
  presignedUrlsEnabled?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate stddev on columns */
export type Buckets_Stddev_Fields = {
  __typename?: 'buckets_stddev_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_pop on columns */
export type Buckets_Stddev_Pop_Fields = {
  __typename?: 'buckets_stddev_pop_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_samp on columns */
export type Buckets_Stddev_Samp_Fields = {
  __typename?: 'buckets_stddev_samp_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** Streaming cursor of the table "buckets" */
export type Buckets_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Buckets_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Buckets_Stream_Cursor_Value_Input = {
  cacheControl?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  downloadExpiration?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['String']>;
  maxUploadFileSize?: InputMaybe<Scalars['Int']>;
  minUploadFileSize?: InputMaybe<Scalars['Int']>;
  presignedUrlsEnabled?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate sum on columns */
export type Buckets_Sum_Fields = {
  __typename?: 'buckets_sum_fields';
  downloadExpiration?: Maybe<Scalars['Int']>;
  maxUploadFileSize?: Maybe<Scalars['Int']>;
  minUploadFileSize?: Maybe<Scalars['Int']>;
};

/** update columns of table "storage.buckets" */
export enum Buckets_Update_Column {
  /** column name */
  CacheControl = 'cacheControl',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DownloadExpiration = 'downloadExpiration',
  /** column name */
  Id = 'id',
  /** column name */
  MaxUploadFileSize = 'maxUploadFileSize',
  /** column name */
  MinUploadFileSize = 'minUploadFileSize',
  /** column name */
  PresignedUrlsEnabled = 'presignedUrlsEnabled',
  /** column name */
  UpdatedAt = 'updatedAt'
}

export type Buckets_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Buckets_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Buckets_Set_Input>;
  where: Buckets_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Buckets_Var_Pop_Fields = {
  __typename?: 'buckets_var_pop_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** aggregate var_samp on columns */
export type Buckets_Var_Samp_Fields = {
  __typename?: 'buckets_var_samp_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** aggregate variance on columns */
export type Buckets_Variance_Fields = {
  __typename?: 'buckets_variance_fields';
  downloadExpiration?: Maybe<Scalars['Float']>;
  maxUploadFileSize?: Maybe<Scalars['Float']>;
  minUploadFileSize?: Maybe<Scalars['Float']>;
};

/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
export type Bytea_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bytea']>;
  _gt?: InputMaybe<Scalars['bytea']>;
  _gte?: InputMaybe<Scalars['bytea']>;
  _in?: InputMaybe<Array<Scalars['bytea']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['bytea']>;
  _lte?: InputMaybe<Scalars['bytea']>;
  _neq?: InputMaybe<Scalars['bytea']>;
  _nin?: InputMaybe<Array<Scalars['bytea']>>;
};

/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
export type Citext_Comparison_Exp = {
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

/** columns and relationships of "cli_tokens" */
export type CliTokens = {
  __typename?: 'cliTokens';
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  token: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};

/** aggregated selection of "cli_tokens" */
export type CliTokens_Aggregate = {
  __typename?: 'cliTokens_aggregate';
  aggregate?: Maybe<CliTokens_Aggregate_Fields>;
  nodes: Array<CliTokens>;
};

export type CliTokens_Aggregate_Bool_Exp = {
  count?: InputMaybe<CliTokens_Aggregate_Bool_Exp_Count>;
};

export type CliTokens_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<CliTokens_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<CliTokens_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "cli_tokens" */
export type CliTokens_Aggregate_Fields = {
  __typename?: 'cliTokens_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<CliTokens_Max_Fields>;
  min?: Maybe<CliTokens_Min_Fields>;
};


/** aggregate fields of "cli_tokens" */
export type CliTokens_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<CliTokens_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "cli_tokens" */
export type CliTokens_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<CliTokens_Max_Order_By>;
  min?: InputMaybe<CliTokens_Min_Order_By>;
};

/** input type for inserting array relation for remote table "cli_tokens" */
export type CliTokens_Arr_Rel_Insert_Input = {
  data: Array<CliTokens_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<CliTokens_On_Conflict>;
};

/** Boolean expression to filter rows from the table "cli_tokens". All fields are combined with a logical 'AND'. */
export type CliTokens_Bool_Exp = {
  _and?: InputMaybe<Array<CliTokens_Bool_Exp>>;
  _not?: InputMaybe<CliTokens_Bool_Exp>;
  _or?: InputMaybe<Array<CliTokens_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  token?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "cli_tokens" */
export enum CliTokens_Constraint {
  /** unique or primary key constraint on columns "id" */
  CliTokensPkey = 'cliTokens_pkey'
}

/** input type for inserting data into table "cli_tokens" */
export type CliTokens_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  token?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type CliTokens_Max_Fields = {
  __typename?: 'cliTokens_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  token?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "cli_tokens" */
export type CliTokens_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  token?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type CliTokens_Min_Fields = {
  __typename?: 'cliTokens_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  token?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "cli_tokens" */
export type CliTokens_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  token?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "cli_tokens" */
export type CliTokens_Mutation_Response = {
  __typename?: 'cliTokens_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<CliTokens>;
};

/** on_conflict condition type for table "cli_tokens" */
export type CliTokens_On_Conflict = {
  constraint: CliTokens_Constraint;
  update_columns?: Array<CliTokens_Update_Column>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};

/** Ordering options when selecting data from "cli_tokens". */
export type CliTokens_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  token?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: cli_tokens */
export type CliTokens_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "cli_tokens" */
export enum CliTokens_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Token = 'token',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "cli_tokens" */
export type CliTokens_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  token?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "cliTokens" */
export type CliTokens_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: CliTokens_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type CliTokens_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  token?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "cli_tokens" */
export enum CliTokens_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Token = 'token',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

export type CliTokens_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<CliTokens_Set_Input>;
  where: CliTokens_Bool_Exp;
};

/** columns and relationships of "continents" */
export type Continents = {
  __typename?: 'continents';
  /** Continent code */
  code: Scalars['bpchar'];
  /** An array relationship */
  countries: Array<Countries>;
  /** An aggregate relationship */
  countries_aggregate: Countries_Aggregate;
  /** Continent name */
  name?: Maybe<Scalars['String']>;
};


/** columns and relationships of "continents" */
export type ContinentsCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


/** columns and relationships of "continents" */
export type ContinentsCountries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};

/** aggregated selection of "continents" */
export type Continents_Aggregate = {
  __typename?: 'continents_aggregate';
  aggregate?: Maybe<Continents_Aggregate_Fields>;
  nodes: Array<Continents>;
};

/** aggregate fields of "continents" */
export type Continents_Aggregate_Fields = {
  __typename?: 'continents_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Continents_Max_Fields>;
  min?: Maybe<Continents_Min_Fields>;
};


/** aggregate fields of "continents" */
export type Continents_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Continents_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** Boolean expression to filter rows from the table "continents". All fields are combined with a logical 'AND'. */
export type Continents_Bool_Exp = {
  _and?: InputMaybe<Array<Continents_Bool_Exp>>;
  _not?: InputMaybe<Continents_Bool_Exp>;
  _or?: InputMaybe<Array<Continents_Bool_Exp>>;
  code?: InputMaybe<Bpchar_Comparison_Exp>;
  countries?: InputMaybe<Countries_Bool_Exp>;
  countries_aggregate?: InputMaybe<Countries_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "continents" */
export enum Continents_Constraint {
  /** unique or primary key constraint on columns "code" */
  ContinentPkey = 'continent_pkey'
}

/** input type for inserting data into table "continents" */
export type Continents_Insert_Input = {
  /** Continent code */
  code?: InputMaybe<Scalars['bpchar']>;
  countries?: InputMaybe<Countries_Arr_Rel_Insert_Input>;
  /** Continent name */
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type Continents_Max_Fields = {
  __typename?: 'continents_max_fields';
  /** Continent code */
  code?: Maybe<Scalars['bpchar']>;
  /** Continent name */
  name?: Maybe<Scalars['String']>;
};

/** aggregate min on columns */
export type Continents_Min_Fields = {
  __typename?: 'continents_min_fields';
  /** Continent code */
  code?: Maybe<Scalars['bpchar']>;
  /** Continent name */
  name?: Maybe<Scalars['String']>;
};

/** response of any mutation on the table "continents" */
export type Continents_Mutation_Response = {
  __typename?: 'continents_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Continents>;
};

/** input type for inserting object relation for remote table "continents" */
export type Continents_Obj_Rel_Insert_Input = {
  data: Continents_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Continents_On_Conflict>;
};

/** on_conflict condition type for table "continents" */
export type Continents_On_Conflict = {
  constraint: Continents_Constraint;
  update_columns?: Array<Continents_Update_Column>;
  where?: InputMaybe<Continents_Bool_Exp>;
};

/** Ordering options when selecting data from "continents". */
export type Continents_Order_By = {
  code?: InputMaybe<Order_By>;
  countries_aggregate?: InputMaybe<Countries_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
};

/** primary key columns input for table: continents */
export type Continents_Pk_Columns_Input = {
  /** Continent code */
  code: Scalars['bpchar'];
};

/** select columns of table "continents" */
export enum Continents_Select_Column {
  /** column name */
  Code = 'code',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "continents" */
export type Continents_Set_Input = {
  /** Continent code */
  code?: InputMaybe<Scalars['bpchar']>;
  /** Continent name */
  name?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "continents" */
export type Continents_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Continents_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Continents_Stream_Cursor_Value_Input = {
  /** Continent code */
  code?: InputMaybe<Scalars['bpchar']>;
  /** Continent name */
  name?: InputMaybe<Scalars['String']>;
};

/** update columns of table "continents" */
export enum Continents_Update_Column {
  /** column name */
  Code = 'code',
  /** column name */
  Name = 'name'
}

export type Continents_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Continents_Set_Input>;
  where: Continents_Bool_Exp;
};

/** columns and relationships of "countries" */
export type Countries = {
  __typename?: 'countries';
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code: Scalars['bpchar'];
  /** An object relationship */
  continent: Continents;
  continentCode: Scalars['bpchar'];
  emojiFlag?: Maybe<Scalars['String']>;
  /** Full English country name */
  fullName?: Maybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: Maybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['smallint']>;
  /** An array relationship */
  locations: Array<Regions>;
  /** An aggregate relationship */
  locations_aggregate: Regions_Aggregate;
  /** English country name */
  name: Scalars['String'];
  /** An array relationship */
  workspaces: Array<Workspaces>;
  /** An aggregate relationship */
  workspaces_aggregate: Workspaces_Aggregate;
};


/** columns and relationships of "countries" */
export type CountriesLocationsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


/** columns and relationships of "countries" */
export type CountriesLocations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


/** columns and relationships of "countries" */
export type CountriesWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


/** columns and relationships of "countries" */
export type CountriesWorkspaces_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** aggregated selection of "countries" */
export type Countries_Aggregate = {
  __typename?: 'countries_aggregate';
  aggregate?: Maybe<Countries_Aggregate_Fields>;
  nodes: Array<Countries>;
};

export type Countries_Aggregate_Bool_Exp = {
  count?: InputMaybe<Countries_Aggregate_Bool_Exp_Count>;
};

export type Countries_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Countries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Countries_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "countries" */
export type Countries_Aggregate_Fields = {
  __typename?: 'countries_aggregate_fields';
  avg?: Maybe<Countries_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Countries_Max_Fields>;
  min?: Maybe<Countries_Min_Fields>;
  stddev?: Maybe<Countries_Stddev_Fields>;
  stddev_pop?: Maybe<Countries_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Countries_Stddev_Samp_Fields>;
  sum?: Maybe<Countries_Sum_Fields>;
  var_pop?: Maybe<Countries_Var_Pop_Fields>;
  var_samp?: Maybe<Countries_Var_Samp_Fields>;
  variance?: Maybe<Countries_Variance_Fields>;
};


/** aggregate fields of "countries" */
export type Countries_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Countries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "countries" */
export type Countries_Aggregate_Order_By = {
  avg?: InputMaybe<Countries_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Countries_Max_Order_By>;
  min?: InputMaybe<Countries_Min_Order_By>;
  stddev?: InputMaybe<Countries_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Countries_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Countries_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Countries_Sum_Order_By>;
  var_pop?: InputMaybe<Countries_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Countries_Var_Samp_Order_By>;
  variance?: InputMaybe<Countries_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "countries" */
export type Countries_Arr_Rel_Insert_Input = {
  data: Array<Countries_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Countries_On_Conflict>;
};

/** aggregate avg on columns */
export type Countries_Avg_Fields = {
  __typename?: 'countries_avg_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "countries" */
export type Countries_Avg_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "countries". All fields are combined with a logical 'AND'. */
export type Countries_Bool_Exp = {
  _and?: InputMaybe<Array<Countries_Bool_Exp>>;
  _not?: InputMaybe<Countries_Bool_Exp>;
  _or?: InputMaybe<Array<Countries_Bool_Exp>>;
  code?: InputMaybe<Bpchar_Comparison_Exp>;
  continent?: InputMaybe<Continents_Bool_Exp>;
  continentCode?: InputMaybe<Bpchar_Comparison_Exp>;
  emojiFlag?: InputMaybe<String_Comparison_Exp>;
  fullName?: InputMaybe<String_Comparison_Exp>;
  iso3?: InputMaybe<Bpchar_Comparison_Exp>;
  isoNumber?: InputMaybe<Smallint_Comparison_Exp>;
  locations?: InputMaybe<Regions_Bool_Exp>;
  locations_aggregate?: InputMaybe<Regions_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  workspaces?: InputMaybe<Workspaces_Bool_Exp>;
  workspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "countries" */
export enum Countries_Constraint {
  /** unique or primary key constraint on columns "code" */
  CountryPkey = 'country_pkey'
}

/** input type for incrementing numeric columns in table "countries" */
export type Countries_Inc_Input = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Scalars['smallint']>;
};

/** input type for inserting data into table "countries" */
export type Countries_Insert_Input = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Scalars['bpchar']>;
  continent?: InputMaybe<Continents_Obj_Rel_Insert_Input>;
  continentCode?: InputMaybe<Scalars['bpchar']>;
  emojiFlag?: InputMaybe<Scalars['String']>;
  /** Full English country name */
  fullName?: InputMaybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: InputMaybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Scalars['smallint']>;
  locations?: InputMaybe<Regions_Arr_Rel_Insert_Input>;
  /** English country name */
  name?: InputMaybe<Scalars['String']>;
  workspaces?: InputMaybe<Workspaces_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Countries_Max_Fields = {
  __typename?: 'countries_max_fields';
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: Maybe<Scalars['bpchar']>;
  continentCode?: Maybe<Scalars['bpchar']>;
  emojiFlag?: Maybe<Scalars['String']>;
  /** Full English country name */
  fullName?: Maybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: Maybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['smallint']>;
  /** English country name */
  name?: Maybe<Scalars['String']>;
};

/** order by max() on columns of table "countries" */
export type Countries_Max_Order_By = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  /** Full English country name */
  fullName?: InputMaybe<Order_By>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: InputMaybe<Order_By>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
  /** English country name */
  name?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Countries_Min_Fields = {
  __typename?: 'countries_min_fields';
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: Maybe<Scalars['bpchar']>;
  continentCode?: Maybe<Scalars['bpchar']>;
  emojiFlag?: Maybe<Scalars['String']>;
  /** Full English country name */
  fullName?: Maybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: Maybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['smallint']>;
  /** English country name */
  name?: Maybe<Scalars['String']>;
};

/** order by min() on columns of table "countries" */
export type Countries_Min_Order_By = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  /** Full English country name */
  fullName?: InputMaybe<Order_By>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: InputMaybe<Order_By>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
  /** English country name */
  name?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "countries" */
export type Countries_Mutation_Response = {
  __typename?: 'countries_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Countries>;
};

/** input type for inserting object relation for remote table "countries" */
export type Countries_Obj_Rel_Insert_Input = {
  data: Countries_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Countries_On_Conflict>;
};

/** on_conflict condition type for table "countries" */
export type Countries_On_Conflict = {
  constraint: Countries_Constraint;
  update_columns?: Array<Countries_Update_Column>;
  where?: InputMaybe<Countries_Bool_Exp>;
};

/** Ordering options when selecting data from "countries". */
export type Countries_Order_By = {
  code?: InputMaybe<Order_By>;
  continent?: InputMaybe<Continents_Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  iso3?: InputMaybe<Order_By>;
  isoNumber?: InputMaybe<Order_By>;
  locations_aggregate?: InputMaybe<Regions_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  workspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Order_By>;
};

/** primary key columns input for table: countries */
export type Countries_Pk_Columns_Input = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code: Scalars['bpchar'];
};

/** select columns of table "countries" */
export enum Countries_Select_Column {
  /** column name */
  Code = 'code',
  /** column name */
  ContinentCode = 'continentCode',
  /** column name */
  EmojiFlag = 'emojiFlag',
  /** column name */
  FullName = 'fullName',
  /** column name */
  Iso3 = 'iso3',
  /** column name */
  IsoNumber = 'isoNumber',
  /** column name */
  Name = 'name'
}

/** input type for updating data in table "countries" */
export type Countries_Set_Input = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Scalars['bpchar']>;
  continentCode?: InputMaybe<Scalars['bpchar']>;
  emojiFlag?: InputMaybe<Scalars['String']>;
  /** Full English country name */
  fullName?: InputMaybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: InputMaybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Scalars['smallint']>;
  /** English country name */
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate stddev on columns */
export type Countries_Stddev_Fields = {
  __typename?: 'countries_stddev_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "countries" */
export type Countries_Stddev_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Countries_Stddev_Pop_Fields = {
  __typename?: 'countries_stddev_pop_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "countries" */
export type Countries_Stddev_Pop_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Countries_Stddev_Samp_Fields = {
  __typename?: 'countries_stddev_samp_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "countries" */
export type Countries_Stddev_Samp_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "countries" */
export type Countries_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Countries_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Countries_Stream_Cursor_Value_Input = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Scalars['bpchar']>;
  continentCode?: InputMaybe<Scalars['bpchar']>;
  emojiFlag?: InputMaybe<Scalars['String']>;
  /** Full English country name */
  fullName?: InputMaybe<Scalars['String']>;
  /** Three-letter country code (ISO 3166-1 alpha-3) */
  iso3?: InputMaybe<Scalars['bpchar']>;
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Scalars['smallint']>;
  /** English country name */
  name?: InputMaybe<Scalars['String']>;
};

/** aggregate sum on columns */
export type Countries_Sum_Fields = {
  __typename?: 'countries_sum_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['smallint']>;
};

/** order by sum() on columns of table "countries" */
export type Countries_Sum_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** update columns of table "countries" */
export enum Countries_Update_Column {
  /** column name */
  Code = 'code',
  /** column name */
  ContinentCode = 'continentCode',
  /** column name */
  EmojiFlag = 'emojiFlag',
  /** column name */
  FullName = 'fullName',
  /** column name */
  Iso3 = 'iso3',
  /** column name */
  IsoNumber = 'isoNumber',
  /** column name */
  Name = 'name'
}

export type Countries_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Countries_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Countries_Set_Input>;
  where: Countries_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Countries_Var_Pop_Fields = {
  __typename?: 'countries_var_pop_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "countries" */
export type Countries_Var_Pop_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Countries_Var_Samp_Fields = {
  __typename?: 'countries_var_samp_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "countries" */
export type Countries_Var_Samp_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Countries_Variance_Fields = {
  __typename?: 'countries_variance_fields';
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "countries" */
export type Countries_Variance_Order_By = {
  /** Three-letter country code (ISO 3166-1 numeric) */
  isoNumber?: InputMaybe<Order_By>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = 'ASC',
  /** descending ordering of the cursor */
  Desc = 'DESC'
}

/** columns and relationships of "deployment_logs" */
export type DeploymentLogs = {
  __typename?: 'deploymentLogs';
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  deployment: Deployments;
  deploymentId: Scalars['uuid'];
  id: Scalars['uuid'];
  message: Scalars['String'];
};

/** aggregated selection of "deployment_logs" */
export type DeploymentLogs_Aggregate = {
  __typename?: 'deploymentLogs_aggregate';
  aggregate?: Maybe<DeploymentLogs_Aggregate_Fields>;
  nodes: Array<DeploymentLogs>;
};

export type DeploymentLogs_Aggregate_Bool_Exp = {
  count?: InputMaybe<DeploymentLogs_Aggregate_Bool_Exp_Count>;
};

export type DeploymentLogs_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<DeploymentLogs_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "deployment_logs" */
export type DeploymentLogs_Aggregate_Fields = {
  __typename?: 'deploymentLogs_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<DeploymentLogs_Max_Fields>;
  min?: Maybe<DeploymentLogs_Min_Fields>;
};


/** aggregate fields of "deployment_logs" */
export type DeploymentLogs_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "deployment_logs" */
export type DeploymentLogs_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<DeploymentLogs_Max_Order_By>;
  min?: InputMaybe<DeploymentLogs_Min_Order_By>;
};

/** input type for inserting array relation for remote table "deployment_logs" */
export type DeploymentLogs_Arr_Rel_Insert_Input = {
  data: Array<DeploymentLogs_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<DeploymentLogs_On_Conflict>;
};

/** Boolean expression to filter rows from the table "deployment_logs". All fields are combined with a logical 'AND'. */
export type DeploymentLogs_Bool_Exp = {
  _and?: InputMaybe<Array<DeploymentLogs_Bool_Exp>>;
  _not?: InputMaybe<DeploymentLogs_Bool_Exp>;
  _or?: InputMaybe<Array<DeploymentLogs_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deployment?: InputMaybe<Deployments_Bool_Exp>;
  deploymentId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "deployment_logs" */
export enum DeploymentLogs_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeploymentLogsPkey = 'deployment_logs_pkey'
}

/** input type for inserting data into table "deployment_logs" */
export type DeploymentLogs_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  deployment?: InputMaybe<Deployments_Obj_Rel_Insert_Input>;
  deploymentId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type DeploymentLogs_Max_Fields = {
  __typename?: 'deploymentLogs_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  deploymentId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  message?: Maybe<Scalars['String']>;
};

/** order by max() on columns of table "deployment_logs" */
export type DeploymentLogs_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type DeploymentLogs_Min_Fields = {
  __typename?: 'deploymentLogs_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  deploymentId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  message?: Maybe<Scalars['String']>;
};

/** order by min() on columns of table "deployment_logs" */
export type DeploymentLogs_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "deployment_logs" */
export type DeploymentLogs_Mutation_Response = {
  __typename?: 'deploymentLogs_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<DeploymentLogs>;
};

/** on_conflict condition type for table "deployment_logs" */
export type DeploymentLogs_On_Conflict = {
  constraint: DeploymentLogs_Constraint;
  update_columns?: Array<DeploymentLogs_Update_Column>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};

/** Ordering options when selecting data from "deployment_logs". */
export type DeploymentLogs_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deployment?: InputMaybe<Deployments_Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** primary key columns input for table: deployment_logs */
export type DeploymentLogs_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "deployment_logs" */
export enum DeploymentLogs_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DeploymentId = 'deploymentId',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message'
}

/** input type for updating data in table "deployment_logs" */
export type DeploymentLogs_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "deploymentLogs" */
export type DeploymentLogs_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: DeploymentLogs_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type DeploymentLogs_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
};

/** update columns of table "deployment_logs" */
export enum DeploymentLogs_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DeploymentId = 'deploymentId',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message'
}

export type DeploymentLogs_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<DeploymentLogs_Set_Input>;
  where: DeploymentLogs_Bool_Exp;
};

/** Table that keeps track of deployments done by watchtower */
export type Deployments = {
  __typename?: 'deployments';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  commitMessage?: Maybe<Scalars['String']>;
  commitSHA: Scalars['String'];
  commitUserAvatarUrl?: Maybe<Scalars['String']>;
  commitUserName?: Maybe<Scalars['String']>;
  deploymentEndedAt?: Maybe<Scalars['timestamptz']>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  /** An aggregate relationship */
  deploymentLogs_aggregate: DeploymentLogs_Aggregate;
  deploymentStartedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStatus?: Maybe<Scalars['String']>;
  functionsEndedAt?: Maybe<Scalars['timestamptz']>;
  functionsStartedAt?: Maybe<Scalars['timestamptz']>;
  functionsStatus?: Maybe<Scalars['String']>;
  id: Scalars['uuid'];
  metadataEndedAt?: Maybe<Scalars['timestamptz']>;
  metadataStartedAt?: Maybe<Scalars['timestamptz']>;
  metadataStatus?: Maybe<Scalars['String']>;
  migrationsEndedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStartedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStatus?: Maybe<Scalars['String']>;
};


/** Table that keeps track of deployments done by watchtower */
export type DeploymentsDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


/** Table that keeps track of deployments done by watchtower */
export type DeploymentsDeploymentLogs_AggregateArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};

/** aggregated selection of "deployments" */
export type Deployments_Aggregate = {
  __typename?: 'deployments_aggregate';
  aggregate?: Maybe<Deployments_Aggregate_Fields>;
  nodes: Array<Deployments>;
};

export type Deployments_Aggregate_Bool_Exp = {
  count?: InputMaybe<Deployments_Aggregate_Bool_Exp_Count>;
};

export type Deployments_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Deployments_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Deployments_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "deployments" */
export type Deployments_Aggregate_Fields = {
  __typename?: 'deployments_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Deployments_Max_Fields>;
  min?: Maybe<Deployments_Min_Fields>;
};


/** aggregate fields of "deployments" */
export type Deployments_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Deployments_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "deployments" */
export type Deployments_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Deployments_Max_Order_By>;
  min?: InputMaybe<Deployments_Min_Order_By>;
};

/** input type for inserting array relation for remote table "deployments" */
export type Deployments_Arr_Rel_Insert_Input = {
  data: Array<Deployments_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};

/** Boolean expression to filter rows from the table "deployments". All fields are combined with a logical 'AND'. */
export type Deployments_Bool_Exp = {
  _and?: InputMaybe<Array<Deployments_Bool_Exp>>;
  _not?: InputMaybe<Deployments_Bool_Exp>;
  _or?: InputMaybe<Array<Deployments_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  commitMessage?: InputMaybe<String_Comparison_Exp>;
  commitSHA?: InputMaybe<String_Comparison_Exp>;
  commitUserAvatarUrl?: InputMaybe<String_Comparison_Exp>;
  commitUserName?: InputMaybe<String_Comparison_Exp>;
  deploymentEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deploymentLogs?: InputMaybe<DeploymentLogs_Bool_Exp>;
  deploymentLogs_aggregate?: InputMaybe<DeploymentLogs_Aggregate_Bool_Exp>;
  deploymentStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deploymentStatus?: InputMaybe<String_Comparison_Exp>;
  functionsEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  functionsStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  functionsStatus?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  metadataEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  metadataStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  metadataStatus?: InputMaybe<String_Comparison_Exp>;
  migrationsEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  migrationsStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  migrationsStatus?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "deployments" */
export enum Deployments_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeploymentsPkey = 'deployments_pkey'
}

/** input type for inserting data into table "deployments" */
export type Deployments_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  commitMessage?: InputMaybe<Scalars['String']>;
  commitSHA?: InputMaybe<Scalars['String']>;
  commitUserAvatarUrl?: InputMaybe<Scalars['String']>;
  commitUserName?: InputMaybe<Scalars['String']>;
  deploymentEndedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentLogs?: InputMaybe<DeploymentLogs_Arr_Rel_Insert_Input>;
  deploymentStartedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStatus?: InputMaybe<Scalars['String']>;
  functionsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStatus?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  metadataEndedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStartedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStatus?: InputMaybe<Scalars['String']>;
  migrationsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStatus?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type Deployments_Max_Fields = {
  __typename?: 'deployments_max_fields';
  appId?: Maybe<Scalars['uuid']>;
  commitMessage?: Maybe<Scalars['String']>;
  commitSHA?: Maybe<Scalars['String']>;
  commitUserAvatarUrl?: Maybe<Scalars['String']>;
  commitUserName?: Maybe<Scalars['String']>;
  deploymentEndedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStartedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStatus?: Maybe<Scalars['String']>;
  functionsEndedAt?: Maybe<Scalars['timestamptz']>;
  functionsStartedAt?: Maybe<Scalars['timestamptz']>;
  functionsStatus?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  metadataEndedAt?: Maybe<Scalars['timestamptz']>;
  metadataStartedAt?: Maybe<Scalars['timestamptz']>;
  metadataStatus?: Maybe<Scalars['String']>;
  migrationsEndedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStartedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStatus?: Maybe<Scalars['String']>;
};

/** order by max() on columns of table "deployments" */
export type Deployments_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Deployments_Min_Fields = {
  __typename?: 'deployments_min_fields';
  appId?: Maybe<Scalars['uuid']>;
  commitMessage?: Maybe<Scalars['String']>;
  commitSHA?: Maybe<Scalars['String']>;
  commitUserAvatarUrl?: Maybe<Scalars['String']>;
  commitUserName?: Maybe<Scalars['String']>;
  deploymentEndedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStartedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStatus?: Maybe<Scalars['String']>;
  functionsEndedAt?: Maybe<Scalars['timestamptz']>;
  functionsStartedAt?: Maybe<Scalars['timestamptz']>;
  functionsStatus?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  metadataEndedAt?: Maybe<Scalars['timestamptz']>;
  metadataStartedAt?: Maybe<Scalars['timestamptz']>;
  metadataStatus?: Maybe<Scalars['String']>;
  migrationsEndedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStartedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStatus?: Maybe<Scalars['String']>;
};

/** order by min() on columns of table "deployments" */
export type Deployments_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "deployments" */
export type Deployments_Mutation_Response = {
  __typename?: 'deployments_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Deployments>;
};

/** input type for inserting object relation for remote table "deployments" */
export type Deployments_Obj_Rel_Insert_Input = {
  data: Deployments_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};

/** on_conflict condition type for table "deployments" */
export type Deployments_On_Conflict = {
  constraint: Deployments_Constraint;
  update_columns?: Array<Deployments_Update_Column>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};

/** Ordering options when selecting data from "deployments". */
export type Deployments_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentLogs_aggregate?: InputMaybe<DeploymentLogs_Aggregate_Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** primary key columns input for table: deployments */
export type Deployments_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "deployments" */
export enum Deployments_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CommitMessage = 'commitMessage',
  /** column name */
  CommitSha = 'commitSHA',
  /** column name */
  CommitUserAvatarUrl = 'commitUserAvatarUrl',
  /** column name */
  CommitUserName = 'commitUserName',
  /** column name */
  DeploymentEndedAt = 'deploymentEndedAt',
  /** column name */
  DeploymentStartedAt = 'deploymentStartedAt',
  /** column name */
  DeploymentStatus = 'deploymentStatus',
  /** column name */
  FunctionsEndedAt = 'functionsEndedAt',
  /** column name */
  FunctionsStartedAt = 'functionsStartedAt',
  /** column name */
  FunctionsStatus = 'functionsStatus',
  /** column name */
  Id = 'id',
  /** column name */
  MetadataEndedAt = 'metadataEndedAt',
  /** column name */
  MetadataStartedAt = 'metadataStartedAt',
  /** column name */
  MetadataStatus = 'metadataStatus',
  /** column name */
  MigrationsEndedAt = 'migrationsEndedAt',
  /** column name */
  MigrationsStartedAt = 'migrationsStartedAt',
  /** column name */
  MigrationsStatus = 'migrationsStatus'
}

/** input type for updating data in table "deployments" */
export type Deployments_Set_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  commitMessage?: InputMaybe<Scalars['String']>;
  commitSHA?: InputMaybe<Scalars['String']>;
  commitUserAvatarUrl?: InputMaybe<Scalars['String']>;
  commitUserName?: InputMaybe<Scalars['String']>;
  deploymentEndedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStartedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStatus?: InputMaybe<Scalars['String']>;
  functionsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStatus?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  metadataEndedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStartedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStatus?: InputMaybe<Scalars['String']>;
  migrationsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStatus?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "deployments" */
export type Deployments_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Deployments_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Deployments_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  commitMessage?: InputMaybe<Scalars['String']>;
  commitSHA?: InputMaybe<Scalars['String']>;
  commitUserAvatarUrl?: InputMaybe<Scalars['String']>;
  commitUserName?: InputMaybe<Scalars['String']>;
  deploymentEndedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStartedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStatus?: InputMaybe<Scalars['String']>;
  functionsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStatus?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  metadataEndedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStartedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStatus?: InputMaybe<Scalars['String']>;
  migrationsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStatus?: InputMaybe<Scalars['String']>;
};

/** update columns of table "deployments" */
export enum Deployments_Update_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CommitMessage = 'commitMessage',
  /** column name */
  CommitSha = 'commitSHA',
  /** column name */
  CommitUserAvatarUrl = 'commitUserAvatarUrl',
  /** column name */
  CommitUserName = 'commitUserName',
  /** column name */
  DeploymentEndedAt = 'deploymentEndedAt',
  /** column name */
  DeploymentStartedAt = 'deploymentStartedAt',
  /** column name */
  DeploymentStatus = 'deploymentStatus',
  /** column name */
  FunctionsEndedAt = 'functionsEndedAt',
  /** column name */
  FunctionsStartedAt = 'functionsStartedAt',
  /** column name */
  FunctionsStatus = 'functionsStatus',
  /** column name */
  Id = 'id',
  /** column name */
  MetadataEndedAt = 'metadataEndedAt',
  /** column name */
  MetadataStartedAt = 'metadataStartedAt',
  /** column name */
  MetadataStatus = 'metadataStatus',
  /** column name */
  MigrationsEndedAt = 'migrationsEndedAt',
  /** column name */
  MigrationsStartedAt = 'migrationsStartedAt',
  /** column name */
  MigrationsStatus = 'migrationsStatus'
}

export type Deployments_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Deployments_Set_Input>;
  where: Deployments_Bool_Exp;
};

/** columns and relationships of "environment_variables" */
export type EnvironmentVariables = {
  __typename?: 'environmentVariables';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  createdAt: Scalars['timestamptz'];
  devValue: Scalars['String'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  prodValue: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
};

/** aggregated selection of "environment_variables" */
export type EnvironmentVariables_Aggregate = {
  __typename?: 'environmentVariables_aggregate';
  aggregate?: Maybe<EnvironmentVariables_Aggregate_Fields>;
  nodes: Array<EnvironmentVariables>;
};

export type EnvironmentVariables_Aggregate_Bool_Exp = {
  count?: InputMaybe<EnvironmentVariables_Aggregate_Bool_Exp_Count>;
};

export type EnvironmentVariables_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<EnvironmentVariables_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "environment_variables" */
export type EnvironmentVariables_Aggregate_Fields = {
  __typename?: 'environmentVariables_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<EnvironmentVariables_Max_Fields>;
  min?: Maybe<EnvironmentVariables_Min_Fields>;
};


/** aggregate fields of "environment_variables" */
export type EnvironmentVariables_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "environment_variables" */
export type EnvironmentVariables_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<EnvironmentVariables_Max_Order_By>;
  min?: InputMaybe<EnvironmentVariables_Min_Order_By>;
};

/** input type for inserting array relation for remote table "environment_variables" */
export type EnvironmentVariables_Arr_Rel_Insert_Input = {
  data: Array<EnvironmentVariables_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<EnvironmentVariables_On_Conflict>;
};

/** Boolean expression to filter rows from the table "environment_variables". All fields are combined with a logical 'AND'. */
export type EnvironmentVariables_Bool_Exp = {
  _and?: InputMaybe<Array<EnvironmentVariables_Bool_Exp>>;
  _not?: InputMaybe<EnvironmentVariables_Bool_Exp>;
  _or?: InputMaybe<Array<EnvironmentVariables_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  devValue?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  prodValue?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "environment_variables" */
export enum EnvironmentVariables_Constraint {
  /** unique or primary key constraint on columns "id" */
  AppEnvVarsPkey = 'app_env_vars_pkey',
  /** unique or primary key constraint on columns "name", "app_id" */
  EnvironmentVariablesNameAppIdKey = 'environment_variables_name_app_id_key'
}

/** input type for inserting data into table "environment_variables" */
export type EnvironmentVariables_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  devValue?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  prodValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate max on columns */
export type EnvironmentVariables_Max_Fields = {
  __typename?: 'environmentVariables_max_fields';
  appId?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  devValue?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  prodValue?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "environment_variables" */
export type EnvironmentVariables_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  devValue?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  prodValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type EnvironmentVariables_Min_Fields = {
  __typename?: 'environmentVariables_min_fields';
  appId?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  devValue?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  prodValue?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "environment_variables" */
export type EnvironmentVariables_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  devValue?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  prodValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "environment_variables" */
export type EnvironmentVariables_Mutation_Response = {
  __typename?: 'environmentVariables_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<EnvironmentVariables>;
};

/** on_conflict condition type for table "environment_variables" */
export type EnvironmentVariables_On_Conflict = {
  constraint: EnvironmentVariables_Constraint;
  update_columns?: Array<EnvironmentVariables_Update_Column>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};

/** Ordering options when selecting data from "environment_variables". */
export type EnvironmentVariables_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  devValue?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  prodValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: environment_variables */
export type EnvironmentVariables_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "environment_variables" */
export enum EnvironmentVariables_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DevValue = 'devValue',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  ProdValue = 'prodValue',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "environment_variables" */
export type EnvironmentVariables_Set_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  devValue?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  prodValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** Streaming cursor of the table "environmentVariables" */
export type EnvironmentVariables_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: EnvironmentVariables_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type EnvironmentVariables_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  devValue?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  prodValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** update columns of table "environment_variables" */
export enum EnvironmentVariables_Update_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DevValue = 'devValue',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  ProdValue = 'prodValue',
  /** column name */
  UpdatedAt = 'updatedAt'
}

export type EnvironmentVariables_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<EnvironmentVariables_Set_Input>;
  where: EnvironmentVariables_Bool_Exp;
};

/** columns and relationships of "feature_flags" */
export type FeatureFlags = {
  __typename?: 'featureFlags';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  description: Scalars['String'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  value: Scalars['String'];
};

/** aggregated selection of "feature_flags" */
export type FeatureFlags_Aggregate = {
  __typename?: 'featureFlags_aggregate';
  aggregate?: Maybe<FeatureFlags_Aggregate_Fields>;
  nodes: Array<FeatureFlags>;
};

export type FeatureFlags_Aggregate_Bool_Exp = {
  count?: InputMaybe<FeatureFlags_Aggregate_Bool_Exp_Count>;
};

export type FeatureFlags_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<FeatureFlags_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "feature_flags" */
export type FeatureFlags_Aggregate_Fields = {
  __typename?: 'featureFlags_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<FeatureFlags_Max_Fields>;
  min?: Maybe<FeatureFlags_Min_Fields>;
};


/** aggregate fields of "feature_flags" */
export type FeatureFlags_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "feature_flags" */
export type FeatureFlags_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<FeatureFlags_Max_Order_By>;
  min?: InputMaybe<FeatureFlags_Min_Order_By>;
};

/** input type for inserting array relation for remote table "feature_flags" */
export type FeatureFlags_Arr_Rel_Insert_Input = {
  data: Array<FeatureFlags_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};

/** Boolean expression to filter rows from the table "feature_flags". All fields are combined with a logical 'AND'. */
export type FeatureFlags_Bool_Exp = {
  _and?: InputMaybe<Array<FeatureFlags_Bool_Exp>>;
  _not?: InputMaybe<FeatureFlags_Bool_Exp>;
  _or?: InputMaybe<Array<FeatureFlags_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "feature_flags" */
export enum FeatureFlags_Constraint {
  /** unique or primary key constraint on columns "id" */
  FeatureFlagsPkey = 'feature_flags_pkey'
}

/** input type for inserting data into table "feature_flags" */
export type FeatureFlags_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

/** aggregate max on columns */
export type FeatureFlags_Max_Fields = {
  __typename?: 'featureFlags_max_fields';
  appId?: Maybe<Scalars['uuid']>;
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

/** order by max() on columns of table "feature_flags" */
export type FeatureFlags_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type FeatureFlags_Min_Fields = {
  __typename?: 'featureFlags_min_fields';
  appId?: Maybe<Scalars['uuid']>;
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

/** order by min() on columns of table "feature_flags" */
export type FeatureFlags_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "feature_flags" */
export type FeatureFlags_Mutation_Response = {
  __typename?: 'featureFlags_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<FeatureFlags>;
};

/** on_conflict condition type for table "feature_flags" */
export type FeatureFlags_On_Conflict = {
  constraint: FeatureFlags_Constraint;
  update_columns?: Array<FeatureFlags_Update_Column>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};

/** Ordering options when selecting data from "feature_flags". */
export type FeatureFlags_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** primary key columns input for table: feature_flags */
export type FeatureFlags_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "feature_flags" */
export enum FeatureFlags_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Value = 'value'
}

/** input type for updating data in table "feature_flags" */
export type FeatureFlags_Set_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "featureFlags" */
export type FeatureFlags_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: FeatureFlags_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type FeatureFlags_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

/** update columns of table "feature_flags" */
export enum FeatureFlags_Update_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Value = 'value'
}

export type FeatureFlags_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<FeatureFlags_Set_Input>;
  where: FeatureFlags_Bool_Exp;
};

/** columns and relationships of "feedback" */
export type Feedback = {
  __typename?: 'feedback';
  createdAt: Scalars['timestamptz'];
  feedback: Scalars['String'];
  id: Scalars['Int'];
  sentBy: Scalars['uuid'];
  /** An object relationship */
  user: Users;
};

/** aggregated selection of "feedback" */
export type Feedback_Aggregate = {
  __typename?: 'feedback_aggregate';
  aggregate?: Maybe<Feedback_Aggregate_Fields>;
  nodes: Array<Feedback>;
};

export type Feedback_Aggregate_Bool_Exp = {
  count?: InputMaybe<Feedback_Aggregate_Bool_Exp_Count>;
};

export type Feedback_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Feedback_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Feedback_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "feedback" */
export type Feedback_Aggregate_Fields = {
  __typename?: 'feedback_aggregate_fields';
  avg?: Maybe<Feedback_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Feedback_Max_Fields>;
  min?: Maybe<Feedback_Min_Fields>;
  stddev?: Maybe<Feedback_Stddev_Fields>;
  stddev_pop?: Maybe<Feedback_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Feedback_Stddev_Samp_Fields>;
  sum?: Maybe<Feedback_Sum_Fields>;
  var_pop?: Maybe<Feedback_Var_Pop_Fields>;
  var_samp?: Maybe<Feedback_Var_Samp_Fields>;
  variance?: Maybe<Feedback_Variance_Fields>;
};


/** aggregate fields of "feedback" */
export type Feedback_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Feedback_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "feedback" */
export type Feedback_Aggregate_Order_By = {
  avg?: InputMaybe<Feedback_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Feedback_Max_Order_By>;
  min?: InputMaybe<Feedback_Min_Order_By>;
  stddev?: InputMaybe<Feedback_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Feedback_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Feedback_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Feedback_Sum_Order_By>;
  var_pop?: InputMaybe<Feedback_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Feedback_Var_Samp_Order_By>;
  variance?: InputMaybe<Feedback_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "feedback" */
export type Feedback_Arr_Rel_Insert_Input = {
  data: Array<Feedback_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Feedback_On_Conflict>;
};

/** aggregate avg on columns */
export type Feedback_Avg_Fields = {
  __typename?: 'feedback_avg_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "feedback" */
export type Feedback_Avg_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "feedback". All fields are combined with a logical 'AND'. */
export type Feedback_Bool_Exp = {
  _and?: InputMaybe<Array<Feedback_Bool_Exp>>;
  _not?: InputMaybe<Feedback_Bool_Exp>;
  _or?: InputMaybe<Array<Feedback_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  feedback?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Int_Comparison_Exp>;
  sentBy?: InputMaybe<Uuid_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
};

/** unique or primary key constraints on table "feedback" */
export enum Feedback_Constraint {
  /** unique or primary key constraint on columns "id" */
  FeedbackPkey = 'feedback_pkey'
}

/** input type for incrementing numeric columns in table "feedback" */
export type Feedback_Inc_Input = {
  id?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "feedback" */
export type Feedback_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  feedback?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  sentBy?: InputMaybe<Scalars['uuid']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Feedback_Max_Fields = {
  __typename?: 'feedback_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  feedback?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  sentBy?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "feedback" */
export type Feedback_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  feedback?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  sentBy?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Feedback_Min_Fields = {
  __typename?: 'feedback_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  feedback?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  sentBy?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "feedback" */
export type Feedback_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  feedback?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  sentBy?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "feedback" */
export type Feedback_Mutation_Response = {
  __typename?: 'feedback_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Feedback>;
};

/** on_conflict condition type for table "feedback" */
export type Feedback_On_Conflict = {
  constraint: Feedback_Constraint;
  update_columns?: Array<Feedback_Update_Column>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};

/** Ordering options when selecting data from "feedback". */
export type Feedback_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  feedback?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  sentBy?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
};

/** primary key columns input for table: feedback */
export type Feedback_Pk_Columns_Input = {
  id: Scalars['Int'];
};

/** select columns of table "feedback" */
export enum Feedback_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Feedback = 'feedback',
  /** column name */
  Id = 'id',
  /** column name */
  SentBy = 'sentBy'
}

/** input type for updating data in table "feedback" */
export type Feedback_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  feedback?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  sentBy?: InputMaybe<Scalars['uuid']>;
};

/** aggregate stddev on columns */
export type Feedback_Stddev_Fields = {
  __typename?: 'feedback_stddev_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "feedback" */
export type Feedback_Stddev_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Feedback_Stddev_Pop_Fields = {
  __typename?: 'feedback_stddev_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "feedback" */
export type Feedback_Stddev_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Feedback_Stddev_Samp_Fields = {
  __typename?: 'feedback_stddev_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "feedback" */
export type Feedback_Stddev_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "feedback" */
export type Feedback_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Feedback_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Feedback_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  feedback?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  sentBy?: InputMaybe<Scalars['uuid']>;
};

/** aggregate sum on columns */
export type Feedback_Sum_Fields = {
  __typename?: 'feedback_sum_fields';
  id?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "feedback" */
export type Feedback_Sum_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** update columns of table "feedback" */
export enum Feedback_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Feedback = 'feedback',
  /** column name */
  Id = 'id',
  /** column name */
  SentBy = 'sentBy'
}

export type Feedback_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Feedback_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Feedback_Set_Input>;
  where: Feedback_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Feedback_Var_Pop_Fields = {
  __typename?: 'feedback_var_pop_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "feedback" */
export type Feedback_Var_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Feedback_Var_Samp_Fields = {
  __typename?: 'feedback_var_samp_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "feedback" */
export type Feedback_Var_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Feedback_Variance_Fields = {
  __typename?: 'feedback_variance_fields';
  id?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "feedback" */
export type Feedback_Variance_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** columns and relationships of "storage.files" */
export type Files = {
  __typename?: 'files';
  /** An object relationship */
  bucket: Buckets;
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

/** aggregated selection of "storage.files" */
export type Files_Aggregate = {
  __typename?: 'files_aggregate';
  aggregate?: Maybe<Files_Aggregate_Fields>;
  nodes: Array<Files>;
};

export type Files_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Files_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Files_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Files_Aggregate_Bool_Exp_Count>;
};

export type Files_Aggregate_Bool_Exp_Bool_And = {
  arguments: Files_Select_Column_Files_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Files_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Files_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Files_Select_Column_Files_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Files_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Files_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Files_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Files_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "storage.files" */
export type Files_Aggregate_Fields = {
  __typename?: 'files_aggregate_fields';
  avg?: Maybe<Files_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Files_Max_Fields>;
  min?: Maybe<Files_Min_Fields>;
  stddev?: Maybe<Files_Stddev_Fields>;
  stddev_pop?: Maybe<Files_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Files_Stddev_Samp_Fields>;
  sum?: Maybe<Files_Sum_Fields>;
  var_pop?: Maybe<Files_Var_Pop_Fields>;
  var_samp?: Maybe<Files_Var_Samp_Fields>;
  variance?: Maybe<Files_Variance_Fields>;
};


/** aggregate fields of "storage.files" */
export type Files_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Files_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "storage.files" */
export type Files_Aggregate_Order_By = {
  avg?: InputMaybe<Files_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Files_Max_Order_By>;
  min?: InputMaybe<Files_Min_Order_By>;
  stddev?: InputMaybe<Files_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Files_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Files_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Files_Sum_Order_By>;
  var_pop?: InputMaybe<Files_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Files_Var_Samp_Order_By>;
  variance?: InputMaybe<Files_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "storage.files" */
export type Files_Arr_Rel_Insert_Input = {
  data: Array<Files_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Files_On_Conflict>;
};

/** aggregate avg on columns */
export type Files_Avg_Fields = {
  __typename?: 'files_avg_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "storage.files" */
export type Files_Avg_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
export type Files_Bool_Exp = {
  _and?: InputMaybe<Array<Files_Bool_Exp>>;
  _not?: InputMaybe<Files_Bool_Exp>;
  _or?: InputMaybe<Array<Files_Bool_Exp>>;
  bucket?: InputMaybe<Buckets_Bool_Exp>;
  bucketId?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  etag?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isUploaded?: InputMaybe<Boolean_Comparison_Exp>;
  mimeType?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  size?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  uploadedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "storage.files" */
export enum Files_Constraint {
  /** unique or primary key constraint on columns "id" */
  FilesPkey = 'files_pkey'
}

/** input type for incrementing numeric columns in table "storage.files" */
export type Files_Inc_Input = {
  size?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "storage.files" */
export type Files_Insert_Input = {
  bucket?: InputMaybe<Buckets_Obj_Rel_Insert_Input>;
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

/** aggregate max on columns */
export type Files_Max_Fields = {
  __typename?: 'files_max_fields';
  bucketId?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  etag?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  mimeType?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  size?: Maybe<Scalars['Int']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  uploadedByUserId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "storage.files" */
export type Files_Max_Order_By = {
  bucketId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  etag?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mimeType?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  uploadedByUserId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Files_Min_Fields = {
  __typename?: 'files_min_fields';
  bucketId?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  etag?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  mimeType?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  size?: Maybe<Scalars['Int']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  uploadedByUserId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "storage.files" */
export type Files_Min_Order_By = {
  bucketId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  etag?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mimeType?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  uploadedByUserId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "storage.files" */
export type Files_Mutation_Response = {
  __typename?: 'files_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Files>;
};

/** on_conflict condition type for table "storage.files" */
export type Files_On_Conflict = {
  constraint: Files_Constraint;
  update_columns?: Array<Files_Update_Column>;
  where?: InputMaybe<Files_Bool_Exp>;
};

/** Ordering options when selecting data from "storage.files". */
export type Files_Order_By = {
  bucket?: InputMaybe<Buckets_Order_By>;
  bucketId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  etag?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isUploaded?: InputMaybe<Order_By>;
  mimeType?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  uploadedByUserId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: storage.files */
export type Files_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "storage.files" */
export enum Files_Select_Column {
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

/** select "files_aggregate_bool_exp_bool_and_arguments_columns" columns of table "storage.files" */
export enum Files_Select_Column_Files_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsUploaded = 'isUploaded'
}

/** select "files_aggregate_bool_exp_bool_or_arguments_columns" columns of table "storage.files" */
export enum Files_Select_Column_Files_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsUploaded = 'isUploaded'
}

/** input type for updating data in table "storage.files" */
export type Files_Set_Input = {
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

/** aggregate stddev on columns */
export type Files_Stddev_Fields = {
  __typename?: 'files_stddev_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "storage.files" */
export type Files_Stddev_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type Files_Stddev_Pop_Fields = {
  __typename?: 'files_stddev_pop_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "storage.files" */
export type Files_Stddev_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type Files_Stddev_Samp_Fields = {
  __typename?: 'files_stddev_samp_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "storage.files" */
export type Files_Stddev_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "files" */
export type Files_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Files_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Files_Stream_Cursor_Value_Input = {
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

/** aggregate sum on columns */
export type Files_Sum_Fields = {
  __typename?: 'files_sum_fields';
  size?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "storage.files" */
export type Files_Sum_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** update columns of table "storage.files" */
export enum Files_Update_Column {
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

export type Files_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Files_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Files_Set_Input>;
  where: Files_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Files_Var_Pop_Fields = {
  __typename?: 'files_var_pop_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "storage.files" */
export type Files_Var_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type Files_Var_Samp_Fields = {
  __typename?: 'files_var_samp_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "storage.files" */
export type Files_Var_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type Files_Variance_Fields = {
  __typename?: 'files_variance_fields';
  size?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "storage.files" */
export type Files_Variance_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** columns and relationships of "github_app_installations" */
export type GithubAppInstallations = {
  __typename?: 'githubAppInstallations';
  accountAvatarUrl?: Maybe<Scalars['String']>;
  accountLogin?: Maybe<Scalars['String']>;
  accountNodeId?: Maybe<Scalars['String']>;
  accountType?: Maybe<Scalars['String']>;
  createdAt: Scalars['timestamptz'];
  externalGithubAppInstallationId?: Maybe<Scalars['Int']>;
  githubData?: Maybe<Scalars['jsonb']>;
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  /** An aggregate relationship */
  githubRepositories_aggregate: GithubRepositories_Aggregate;
  id: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user?: Maybe<Users>;
  userId?: Maybe<Scalars['uuid']>;
};


/** columns and relationships of "github_app_installations" */
export type GithubAppInstallationsGithubDataArgs = {
  path?: InputMaybe<Scalars['String']>;
};


/** columns and relationships of "github_app_installations" */
export type GithubAppInstallationsGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


/** columns and relationships of "github_app_installations" */
export type GithubAppInstallationsGithubRepositories_AggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};

/** aggregated selection of "github_app_installations" */
export type GithubAppInstallations_Aggregate = {
  __typename?: 'githubAppInstallations_aggregate';
  aggregate?: Maybe<GithubAppInstallations_Aggregate_Fields>;
  nodes: Array<GithubAppInstallations>;
};

export type GithubAppInstallations_Aggregate_Bool_Exp = {
  count?: InputMaybe<GithubAppInstallations_Aggregate_Bool_Exp_Count>;
};

export type GithubAppInstallations_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "github_app_installations" */
export type GithubAppInstallations_Aggregate_Fields = {
  __typename?: 'githubAppInstallations_aggregate_fields';
  avg?: Maybe<GithubAppInstallations_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<GithubAppInstallations_Max_Fields>;
  min?: Maybe<GithubAppInstallations_Min_Fields>;
  stddev?: Maybe<GithubAppInstallations_Stddev_Fields>;
  stddev_pop?: Maybe<GithubAppInstallations_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<GithubAppInstallations_Stddev_Samp_Fields>;
  sum?: Maybe<GithubAppInstallations_Sum_Fields>;
  var_pop?: Maybe<GithubAppInstallations_Var_Pop_Fields>;
  var_samp?: Maybe<GithubAppInstallations_Var_Samp_Fields>;
  variance?: Maybe<GithubAppInstallations_Variance_Fields>;
};


/** aggregate fields of "github_app_installations" */
export type GithubAppInstallations_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "github_app_installations" */
export type GithubAppInstallations_Aggregate_Order_By = {
  avg?: InputMaybe<GithubAppInstallations_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<GithubAppInstallations_Max_Order_By>;
  min?: InputMaybe<GithubAppInstallations_Min_Order_By>;
  stddev?: InputMaybe<GithubAppInstallations_Stddev_Order_By>;
  stddev_pop?: InputMaybe<GithubAppInstallations_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<GithubAppInstallations_Stddev_Samp_Order_By>;
  sum?: InputMaybe<GithubAppInstallations_Sum_Order_By>;
  var_pop?: InputMaybe<GithubAppInstallations_Var_Pop_Order_By>;
  var_samp?: InputMaybe<GithubAppInstallations_Var_Samp_Order_By>;
  variance?: InputMaybe<GithubAppInstallations_Variance_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type GithubAppInstallations_Append_Input = {
  githubData?: InputMaybe<Scalars['jsonb']>;
};

/** input type for inserting array relation for remote table "github_app_installations" */
export type GithubAppInstallations_Arr_Rel_Insert_Input = {
  data: Array<GithubAppInstallations_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};

/** aggregate avg on columns */
export type GithubAppInstallations_Avg_Fields = {
  __typename?: 'githubAppInstallations_avg_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "github_app_installations" */
export type GithubAppInstallations_Avg_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "github_app_installations". All fields are combined with a logical 'AND'. */
export type GithubAppInstallations_Bool_Exp = {
  _and?: InputMaybe<Array<GithubAppInstallations_Bool_Exp>>;
  _not?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  _or?: InputMaybe<Array<GithubAppInstallations_Bool_Exp>>;
  accountAvatarUrl?: InputMaybe<String_Comparison_Exp>;
  accountLogin?: InputMaybe<String_Comparison_Exp>;
  accountNodeId?: InputMaybe<String_Comparison_Exp>;
  accountType?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  externalGithubAppInstallationId?: InputMaybe<Int_Comparison_Exp>;
  githubData?: InputMaybe<Jsonb_Comparison_Exp>;
  githubRepositories?: InputMaybe<GithubRepositories_Bool_Exp>;
  githubRepositories_aggregate?: InputMaybe<GithubRepositories_Aggregate_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "github_app_installations" */
export enum GithubAppInstallations_Constraint {
  /** unique or primary key constraint on columns "external_github_app_installation_id" */
  GithubAppInstallationsExternalGithubAppInstallationIKey = 'github_app_installations_external_github_app_installation_i_key',
  /** unique or primary key constraint on columns "id" */
  GithubAppInstallationsPkey = 'github_app_installations_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type GithubAppInstallations_Delete_At_Path_Input = {
  githubData?: InputMaybe<Array<Scalars['String']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type GithubAppInstallations_Delete_Elem_Input = {
  githubData?: InputMaybe<Scalars['Int']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type GithubAppInstallations_Delete_Key_Input = {
  githubData?: InputMaybe<Scalars['String']>;
};

/** input type for incrementing numeric columns in table "github_app_installations" */
export type GithubAppInstallations_Inc_Input = {
  externalGithubAppInstallationId?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "github_app_installations" */
export type GithubAppInstallations_Insert_Input = {
  accountAvatarUrl?: InputMaybe<Scalars['String']>;
  accountLogin?: InputMaybe<Scalars['String']>;
  accountNodeId?: InputMaybe<Scalars['String']>;
  accountType?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppInstallationId?: InputMaybe<Scalars['Int']>;
  githubData?: InputMaybe<Scalars['jsonb']>;
  githubRepositories?: InputMaybe<GithubRepositories_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type GithubAppInstallations_Max_Fields = {
  __typename?: 'githubAppInstallations_max_fields';
  accountAvatarUrl?: Maybe<Scalars['String']>;
  accountLogin?: Maybe<Scalars['String']>;
  accountNodeId?: Maybe<Scalars['String']>;
  accountType?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  externalGithubAppInstallationId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "github_app_installations" */
export type GithubAppInstallations_Max_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountNodeId?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type GithubAppInstallations_Min_Fields = {
  __typename?: 'githubAppInstallations_min_fields';
  accountAvatarUrl?: Maybe<Scalars['String']>;
  accountLogin?: Maybe<Scalars['String']>;
  accountNodeId?: Maybe<Scalars['String']>;
  accountType?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  externalGithubAppInstallationId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "github_app_installations" */
export type GithubAppInstallations_Min_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountNodeId?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "github_app_installations" */
export type GithubAppInstallations_Mutation_Response = {
  __typename?: 'githubAppInstallations_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<GithubAppInstallations>;
};

/** input type for inserting object relation for remote table "github_app_installations" */
export type GithubAppInstallations_Obj_Rel_Insert_Input = {
  data: GithubAppInstallations_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};

/** on_conflict condition type for table "github_app_installations" */
export type GithubAppInstallations_On_Conflict = {
  constraint: GithubAppInstallations_Constraint;
  update_columns?: Array<GithubAppInstallations_Update_Column>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};

/** Ordering options when selecting data from "github_app_installations". */
export type GithubAppInstallations_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountNodeId?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
  githubData?: InputMaybe<Order_By>;
  githubRepositories_aggregate?: InputMaybe<GithubRepositories_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: github_app_installations */
export type GithubAppInstallations_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type GithubAppInstallations_Prepend_Input = {
  githubData?: InputMaybe<Scalars['jsonb']>;
};

/** select columns of table "github_app_installations" */
export enum GithubAppInstallations_Select_Column {
  /** column name */
  AccountAvatarUrl = 'accountAvatarUrl',
  /** column name */
  AccountLogin = 'accountLogin',
  /** column name */
  AccountNodeId = 'accountNodeId',
  /** column name */
  AccountType = 'accountType',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExternalGithubAppInstallationId = 'externalGithubAppInstallationId',
  /** column name */
  GithubData = 'githubData',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "github_app_installations" */
export type GithubAppInstallations_Set_Input = {
  accountAvatarUrl?: InputMaybe<Scalars['String']>;
  accountLogin?: InputMaybe<Scalars['String']>;
  accountNodeId?: InputMaybe<Scalars['String']>;
  accountType?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppInstallationId?: InputMaybe<Scalars['Int']>;
  githubData?: InputMaybe<Scalars['jsonb']>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate stddev on columns */
export type GithubAppInstallations_Stddev_Fields = {
  __typename?: 'githubAppInstallations_stddev_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "github_app_installations" */
export type GithubAppInstallations_Stddev_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type GithubAppInstallations_Stddev_Pop_Fields = {
  __typename?: 'githubAppInstallations_stddev_pop_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "github_app_installations" */
export type GithubAppInstallations_Stddev_Pop_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type GithubAppInstallations_Stddev_Samp_Fields = {
  __typename?: 'githubAppInstallations_stddev_samp_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "github_app_installations" */
export type GithubAppInstallations_Stddev_Samp_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "githubAppInstallations" */
export type GithubAppInstallations_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: GithubAppInstallations_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type GithubAppInstallations_Stream_Cursor_Value_Input = {
  accountAvatarUrl?: InputMaybe<Scalars['String']>;
  accountLogin?: InputMaybe<Scalars['String']>;
  accountNodeId?: InputMaybe<Scalars['String']>;
  accountType?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppInstallationId?: InputMaybe<Scalars['Int']>;
  githubData?: InputMaybe<Scalars['jsonb']>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate sum on columns */
export type GithubAppInstallations_Sum_Fields = {
  __typename?: 'githubAppInstallations_sum_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "github_app_installations" */
export type GithubAppInstallations_Sum_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** update columns of table "github_app_installations" */
export enum GithubAppInstallations_Update_Column {
  /** column name */
  AccountAvatarUrl = 'accountAvatarUrl',
  /** column name */
  AccountLogin = 'accountLogin',
  /** column name */
  AccountNodeId = 'accountNodeId',
  /** column name */
  AccountType = 'accountType',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExternalGithubAppInstallationId = 'externalGithubAppInstallationId',
  /** column name */
  GithubData = 'githubData',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

export type GithubAppInstallations_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<GithubAppInstallations_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<GithubAppInstallations_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<GithubAppInstallations_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<GithubAppInstallations_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<GithubAppInstallations_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<GithubAppInstallations_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<GithubAppInstallations_Set_Input>;
  where: GithubAppInstallations_Bool_Exp;
};

/** aggregate var_pop on columns */
export type GithubAppInstallations_Var_Pop_Fields = {
  __typename?: 'githubAppInstallations_var_pop_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "github_app_installations" */
export type GithubAppInstallations_Var_Pop_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type GithubAppInstallations_Var_Samp_Fields = {
  __typename?: 'githubAppInstallations_var_samp_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "github_app_installations" */
export type GithubAppInstallations_Var_Samp_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type GithubAppInstallations_Variance_Fields = {
  __typename?: 'githubAppInstallations_variance_fields';
  externalGithubAppInstallationId?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "github_app_installations" */
export type GithubAppInstallations_Variance_Order_By = {
  externalGithubAppInstallationId?: InputMaybe<Order_By>;
};

/** columns and relationships of "github_repositories" */
export type GithubRepositories = {
  __typename?: 'githubRepositories';
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  createdAt: Scalars['timestamptz'];
  externalGithubAppRepositoryNodeId: Scalars['String'];
  fullName: Scalars['String'];
  /** An object relationship */
  githubAppInstallation: GithubAppInstallations;
  githubAppInstallationId: Scalars['uuid'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  private: Scalars['Boolean'];
  updatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "github_repositories" */
export type GithubRepositoriesAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "github_repositories" */
export type GithubRepositoriesApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** aggregated selection of "github_repositories" */
export type GithubRepositories_Aggregate = {
  __typename?: 'githubRepositories_aggregate';
  aggregate?: Maybe<GithubRepositories_Aggregate_Fields>;
  nodes: Array<GithubRepositories>;
};

export type GithubRepositories_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<GithubRepositories_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<GithubRepositories_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<GithubRepositories_Aggregate_Bool_Exp_Count>;
};

export type GithubRepositories_Aggregate_Bool_Exp_Bool_And = {
  arguments: GithubRepositories_Select_Column_GithubRepositories_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<GithubRepositories_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type GithubRepositories_Aggregate_Bool_Exp_Bool_Or = {
  arguments: GithubRepositories_Select_Column_GithubRepositories_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<GithubRepositories_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type GithubRepositories_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<GithubRepositories_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "github_repositories" */
export type GithubRepositories_Aggregate_Fields = {
  __typename?: 'githubRepositories_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<GithubRepositories_Max_Fields>;
  min?: Maybe<GithubRepositories_Min_Fields>;
};


/** aggregate fields of "github_repositories" */
export type GithubRepositories_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "github_repositories" */
export type GithubRepositories_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<GithubRepositories_Max_Order_By>;
  min?: InputMaybe<GithubRepositories_Min_Order_By>;
};

/** input type for inserting array relation for remote table "github_repositories" */
export type GithubRepositories_Arr_Rel_Insert_Input = {
  data: Array<GithubRepositories_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<GithubRepositories_On_Conflict>;
};

/** Boolean expression to filter rows from the table "github_repositories". All fields are combined with a logical 'AND'. */
export type GithubRepositories_Bool_Exp = {
  _and?: InputMaybe<Array<GithubRepositories_Bool_Exp>>;
  _not?: InputMaybe<GithubRepositories_Bool_Exp>;
  _or?: InputMaybe<Array<GithubRepositories_Bool_Exp>>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  externalGithubAppRepositoryNodeId?: InputMaybe<String_Comparison_Exp>;
  fullName?: InputMaybe<String_Comparison_Exp>;
  githubAppInstallation?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  githubAppInstallationId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  private?: InputMaybe<Boolean_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "github_repositories" */
export enum GithubRepositories_Constraint {
  /** unique or primary key constraint on columns "id" */
  GithubRepositoriesPkey = 'github_repositories_pkey'
}

/** input type for inserting data into table "github_repositories" */
export type GithubRepositories_Insert_Input = {
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Scalars['String']>;
  fullName?: InputMaybe<Scalars['String']>;
  githubAppInstallation?: InputMaybe<GithubAppInstallations_Obj_Rel_Insert_Input>;
  githubAppInstallationId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  private?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate max on columns */
export type GithubRepositories_Max_Fields = {
  __typename?: 'githubRepositories_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  externalGithubAppRepositoryNodeId?: Maybe<Scalars['String']>;
  fullName?: Maybe<Scalars['String']>;
  githubAppInstallationId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "github_repositories" */
export type GithubRepositories_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  githubAppInstallationId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type GithubRepositories_Min_Fields = {
  __typename?: 'githubRepositories_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  externalGithubAppRepositoryNodeId?: Maybe<Scalars['String']>;
  fullName?: Maybe<Scalars['String']>;
  githubAppInstallationId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "github_repositories" */
export type GithubRepositories_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  githubAppInstallationId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "github_repositories" */
export type GithubRepositories_Mutation_Response = {
  __typename?: 'githubRepositories_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<GithubRepositories>;
};

/** input type for inserting object relation for remote table "github_repositories" */
export type GithubRepositories_Obj_Rel_Insert_Input = {
  data: GithubRepositories_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<GithubRepositories_On_Conflict>;
};

/** on_conflict condition type for table "github_repositories" */
export type GithubRepositories_On_Conflict = {
  constraint: GithubRepositories_Constraint;
  update_columns?: Array<GithubRepositories_Update_Column>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};

/** Ordering options when selecting data from "github_repositories". */
export type GithubRepositories_Order_By = {
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  githubAppInstallation?: InputMaybe<GithubAppInstallations_Order_By>;
  githubAppInstallationId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  private?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: github_repositories */
export type GithubRepositories_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "github_repositories" */
export enum GithubRepositories_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExternalGithubAppRepositoryNodeId = 'externalGithubAppRepositoryNodeId',
  /** column name */
  FullName = 'fullName',
  /** column name */
  GithubAppInstallationId = 'githubAppInstallationId',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Private = 'private',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** select "githubRepositories_aggregate_bool_exp_bool_and_arguments_columns" columns of table "github_repositories" */
export enum GithubRepositories_Select_Column_GithubRepositories_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  Private = 'private'
}

/** select "githubRepositories_aggregate_bool_exp_bool_or_arguments_columns" columns of table "github_repositories" */
export enum GithubRepositories_Select_Column_GithubRepositories_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  Private = 'private'
}

/** input type for updating data in table "github_repositories" */
export type GithubRepositories_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Scalars['String']>;
  fullName?: InputMaybe<Scalars['String']>;
  githubAppInstallationId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  private?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** Streaming cursor of the table "githubRepositories" */
export type GithubRepositories_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: GithubRepositories_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type GithubRepositories_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  externalGithubAppRepositoryNodeId?: InputMaybe<Scalars['String']>;
  fullName?: InputMaybe<Scalars['String']>;
  githubAppInstallationId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  private?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** update columns of table "github_repositories" */
export enum GithubRepositories_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExternalGithubAppRepositoryNodeId = 'externalGithubAppRepositoryNodeId',
  /** column name */
  FullName = 'fullName',
  /** column name */
  GithubAppInstallationId = 'githubAppInstallationId',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Private = 'private',
  /** column name */
  UpdatedAt = 'updatedAt'
}

export type GithubRepositories_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<GithubRepositories_Set_Input>;
  where: GithubRepositories_Bool_Exp;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
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
export type Mutation_Root = {
  __typename?: 'mutation_root';
  backupAllApplicationsDatabase: Array<Maybe<BackupResultsItem>>;
  backupApplicationDatabase: BackupResult;
  /** Create a database backup */
  createDatabaseBackup: DatabaseBackupEntry;
  /** delete single row from the table: "apps" */
  deleteApp?: Maybe<Apps>;
  /** delete single row from the table: "app_states" */
  deleteAppState?: Maybe<AppStates>;
  /** delete data from the table: "app_state_history" */
  deleteAppStateHistories?: Maybe<AppStateHistory_Mutation_Response>;
  /** delete single row from the table: "app_state_history" */
  deleteAppStateHistory?: Maybe<AppStateHistory>;
  /** delete data from the table: "app_states" */
  deleteAppStates?: Maybe<AppStates_Mutation_Response>;
  /** delete data from the table: "apps" */
  deleteApps?: Maybe<Apps_Mutation_Response>;
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
  /** delete single row from the table: "auth.user_security_keys" */
  deleteAuthUserSecurityKey?: Maybe<AuthUserSecurityKeys>;
  /** delete data from the table: "auth.user_security_keys" */
  deleteAuthUserSecurityKeys?: Maybe<AuthUserSecurityKeys_Mutation_Response>;
  /** delete single row from the table: "backups" */
  deleteBackup?: Maybe<Backups>;
  /** delete data from the table: "backups" */
  deleteBackups?: Maybe<Backups_Mutation_Response>;
  /** delete single row from the table: "storage.buckets" */
  deleteBucket?: Maybe<Buckets>;
  /** delete data from the table: "storage.buckets" */
  deleteBuckets?: Maybe<Buckets_Mutation_Response>;
  /** delete single row from the table: "cli_tokens" */
  deleteCliToken?: Maybe<CliTokens>;
  /** delete data from the table: "cli_tokens" */
  deleteCliTokens?: Maybe<CliTokens_Mutation_Response>;
  /** delete single row from the table: "deployments" */
  deleteDeployment?: Maybe<Deployments>;
  /** delete single row from the table: "deployment_logs" */
  deleteDeploymentLog?: Maybe<DeploymentLogs>;
  /** delete data from the table: "deployment_logs" */
  deleteDeploymentLogs?: Maybe<DeploymentLogs_Mutation_Response>;
  /** delete data from the table: "deployments" */
  deleteDeployments?: Maybe<Deployments_Mutation_Response>;
  /** delete single row from the table: "environment_variables" */
  deleteEnvironmentVariable?: Maybe<EnvironmentVariables>;
  /** delete data from the table: "environment_variables" */
  deleteEnvironmentVariables?: Maybe<EnvironmentVariables_Mutation_Response>;
  /** delete single row from the table: "feature_flags" */
  deleteFeatureFlag?: Maybe<FeatureFlags>;
  /** delete data from the table: "feature_flags" */
  deleteFeatureFlags?: Maybe<FeatureFlags_Mutation_Response>;
  /** delete data from the table: "feedback" */
  deleteFeedback?: Maybe<Feedback_Mutation_Response>;
  /** delete single row from the table: "feedback" */
  deleteFeedbackOne?: Maybe<Feedback>;
  /** delete single row from the table: "storage.files" */
  deleteFile?: Maybe<Files>;
  /** delete data from the table: "storage.files" */
  deleteFiles?: Maybe<Files_Mutation_Response>;
  /** delete single row from the table: "github_app_installations" */
  deleteGithubAppInstallation?: Maybe<GithubAppInstallations>;
  /** delete data from the table: "github_app_installations" */
  deleteGithubAppInstallations?: Maybe<GithubAppInstallations_Mutation_Response>;
  /** delete data from the table: "github_repositories" */
  deleteGithubRepositories?: Maybe<GithubRepositories_Mutation_Response>;
  /** delete single row from the table: "github_repositories" */
  deleteGithubRepository?: Maybe<GithubRepositories>;
  /** delete single row from the table: "payment_methods" */
  deletePaymentMethod?: Maybe<PaymentMethods>;
  /** delete data from the table: "payment_methods" */
  deletePaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  /** delete single row from the table: "plans" */
  deletePlan?: Maybe<Plans>;
  /** delete data from the table: "plans" */
  deletePlans?: Maybe<Plans_Mutation_Response>;
  /** delete single row from the table: "auth.users" */
  deleteUser?: Maybe<Users>;
  /** delete data from the table: "auth.users" */
  deleteUsers?: Maybe<Users_Mutation_Response>;
  /** delete single row from the table: "workspaces" */
  deleteWorkspace?: Maybe<Workspaces>;
  /** delete single row from the table: "workspace_members" */
  deleteWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** delete single row from the table: "workspace_member_invites" */
  deleteWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** delete data from the table: "workspace_member_invites" */
  deleteWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** delete data from the table: "workspace_members" */
  deleteWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** delete data from the table: "workspaces" */
  deleteWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  /** delete data from the table: "auth.migrations" */
  delete_auth_migrations?: Maybe<Auth_Migrations_Mutation_Response>;
  /** delete single row from the table: "auth.migrations" */
  delete_auth_migrations_by_pk?: Maybe<Auth_Migrations>;
  /** delete data from the table: "continents" */
  delete_continents?: Maybe<Continents_Mutation_Response>;
  /** delete single row from the table: "continents" */
  delete_continents_by_pk?: Maybe<Continents>;
  /** delete data from the table: "countries" */
  delete_countries?: Maybe<Countries_Mutation_Response>;
  /** delete single row from the table: "countries" */
  delete_countries_by_pk?: Maybe<Countries>;
  /** delete data from the table: "regions" */
  delete_regions?: Maybe<Regions_Mutation_Response>;
  /** delete single row from the table: "regions" */
  delete_regions_by_pk?: Maybe<Regions>;
  /** insert a single row into the table: "apps" */
  insertApp?: Maybe<Apps>;
  /** insert a single row into the table: "app_states" */
  insertAppState?: Maybe<AppStates>;
  /** insert data into the table: "app_state_history" */
  insertAppStateHistories?: Maybe<AppStateHistory_Mutation_Response>;
  /** insert a single row into the table: "app_state_history" */
  insertAppStateHistory?: Maybe<AppStateHistory>;
  /** insert data into the table: "app_states" */
  insertAppStates?: Maybe<AppStates_Mutation_Response>;
  /** insert data into the table: "apps" */
  insertApps?: Maybe<Apps_Mutation_Response>;
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
  /** insert a single row into the table: "auth.user_security_keys" */
  insertAuthUserSecurityKey?: Maybe<AuthUserSecurityKeys>;
  /** insert data into the table: "auth.user_security_keys" */
  insertAuthUserSecurityKeys?: Maybe<AuthUserSecurityKeys_Mutation_Response>;
  /** insert a single row into the table: "backups" */
  insertBackup?: Maybe<Backups>;
  /** insert data into the table: "backups" */
  insertBackups?: Maybe<Backups_Mutation_Response>;
  /** insert a single row into the table: "storage.buckets" */
  insertBucket?: Maybe<Buckets>;
  /** insert data into the table: "storage.buckets" */
  insertBuckets?: Maybe<Buckets_Mutation_Response>;
  /** insert a single row into the table: "cli_tokens" */
  insertCliToken?: Maybe<CliTokens>;
  /** insert data into the table: "cli_tokens" */
  insertCliTokens?: Maybe<CliTokens_Mutation_Response>;
  /** insert a single row into the table: "deployments" */
  insertDeployment?: Maybe<Deployments>;
  /** insert a single row into the table: "deployment_logs" */
  insertDeploymentLog?: Maybe<DeploymentLogs>;
  /** insert data into the table: "deployment_logs" */
  insertDeploymentLogs?: Maybe<DeploymentLogs_Mutation_Response>;
  /** insert data into the table: "deployments" */
  insertDeployments?: Maybe<Deployments_Mutation_Response>;
  /** insert a single row into the table: "environment_variables" */
  insertEnvironmentVariable?: Maybe<EnvironmentVariables>;
  /** insert data into the table: "environment_variables" */
  insertEnvironmentVariables?: Maybe<EnvironmentVariables_Mutation_Response>;
  /** insert a single row into the table: "feature_flags" */
  insertFeatureFlag?: Maybe<FeatureFlags>;
  /** insert data into the table: "feature_flags" */
  insertFeatureFlags?: Maybe<FeatureFlags_Mutation_Response>;
  /** insert data into the table: "feedback" */
  insertFeedback?: Maybe<Feedback_Mutation_Response>;
  /** insert a single row into the table: "feedback" */
  insertFeedbackOne?: Maybe<Feedback>;
  /** insert a single row into the table: "storage.files" */
  insertFile?: Maybe<Files>;
  /** insert data into the table: "storage.files" */
  insertFiles?: Maybe<Files_Mutation_Response>;
  /** insert a single row into the table: "github_app_installations" */
  insertGithubAppInstallation?: Maybe<GithubAppInstallations>;
  /** insert data into the table: "github_app_installations" */
  insertGithubAppInstallations?: Maybe<GithubAppInstallations_Mutation_Response>;
  /** insert data into the table: "github_repositories" */
  insertGithubRepositories?: Maybe<GithubRepositories_Mutation_Response>;
  /** insert a single row into the table: "github_repositories" */
  insertGithubRepository?: Maybe<GithubRepositories>;
  /** insert a single row into the table: "payment_methods" */
  insertPaymentMethod?: Maybe<PaymentMethods>;
  /** insert data into the table: "payment_methods" */
  insertPaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  /** insert a single row into the table: "plans" */
  insertPlan?: Maybe<Plans>;
  /** insert data into the table: "plans" */
  insertPlans?: Maybe<Plans_Mutation_Response>;
  /** insert a single row into the table: "auth.users" */
  insertUser?: Maybe<Users>;
  /** insert data into the table: "auth.users" */
  insertUsers?: Maybe<Users_Mutation_Response>;
  /** insert a single row into the table: "workspaces" */
  insertWorkspace?: Maybe<Workspaces>;
  /** insert a single row into the table: "workspace_members" */
  insertWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** insert a single row into the table: "workspace_member_invites" */
  insertWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** insert data into the table: "workspace_member_invites" */
  insertWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** insert data into the table: "workspace_members" */
  insertWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** insert data into the table: "workspaces" */
  insertWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  /** insert data into the table: "auth.migrations" */
  insert_auth_migrations?: Maybe<Auth_Migrations_Mutation_Response>;
  /** insert a single row into the table: "auth.migrations" */
  insert_auth_migrations_one?: Maybe<Auth_Migrations>;
  /** insert data into the table: "continents" */
  insert_continents?: Maybe<Continents_Mutation_Response>;
  /** insert a single row into the table: "continents" */
  insert_continents_one?: Maybe<Continents>;
  /** insert data into the table: "countries" */
  insert_countries?: Maybe<Countries_Mutation_Response>;
  /** insert a single row into the table: "countries" */
  insert_countries_one?: Maybe<Countries>;
  /** insert data into the table: "regions" */
  insert_regions?: Maybe<Regions_Mutation_Response>;
  /** insert a single row into the table: "regions" */
  insert_regions_one?: Maybe<Regions>;
  migrateRDSToPostgres: Scalars['Boolean'];
  /** legacy version */
  pauseInactiveApps: Array<Scalars['uuid']>;
  resetPostgresPassword: Scalars['Boolean'];
  restoreApplicationDatabase: Scalars['Boolean'];
  /** Restore a database backup */
  restoreDatabaseBackup: Scalars['Boolean'];
  /** Schedule a creation of a database backup */
  scheduleCreateDatabaseBackup: Array<Scalars['String']>;
  /** Pausing Tenants */
  schedulePauseInactiveTenants: Array<Scalars['uuid']>;
  /**
   * Database Backups
   * Schedule a restore of a database backup
   */
  scheduleRestoreDatabaseBackup: Scalars['String'];
  syncDatabaseBackups: Scalars['Boolean'];
  /** update single row of the table: "apps" */
  updateApp?: Maybe<Apps>;
  /** update single row of the table: "app_states" */
  updateAppState?: Maybe<AppStates>;
  /** update data of the table: "app_state_history" */
  updateAppStateHistories?: Maybe<AppStateHistory_Mutation_Response>;
  /** update single row of the table: "app_state_history" */
  updateAppStateHistory?: Maybe<AppStateHistory>;
  /** update data of the table: "app_states" */
  updateAppStates?: Maybe<AppStates_Mutation_Response>;
  /** update data of the table: "apps" */
  updateApps?: Maybe<Apps_Mutation_Response>;
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
  /** update single row of the table: "auth.user_security_keys" */
  updateAuthUserSecurityKey?: Maybe<AuthUserSecurityKeys>;
  /** update data of the table: "auth.user_security_keys" */
  updateAuthUserSecurityKeys?: Maybe<AuthUserSecurityKeys_Mutation_Response>;
  /** update single row of the table: "backups" */
  updateBackup?: Maybe<Backups>;
  /** update data of the table: "backups" */
  updateBackups?: Maybe<Backups_Mutation_Response>;
  /** update single row of the table: "storage.buckets" */
  updateBucket?: Maybe<Buckets>;
  /** update data of the table: "storage.buckets" */
  updateBuckets?: Maybe<Buckets_Mutation_Response>;
  /** update single row of the table: "cli_tokens" */
  updateCliToken?: Maybe<CliTokens>;
  /** update data of the table: "cli_tokens" */
  updateCliTokens?: Maybe<CliTokens_Mutation_Response>;
  /** update single row of the table: "deployments" */
  updateDeployment?: Maybe<Deployments>;
  /** update single row of the table: "deployment_logs" */
  updateDeploymentLog?: Maybe<DeploymentLogs>;
  /** update data of the table: "deployment_logs" */
  updateDeploymentLogs?: Maybe<DeploymentLogs_Mutation_Response>;
  /** update data of the table: "deployments" */
  updateDeployments?: Maybe<Deployments_Mutation_Response>;
  /** update single row of the table: "environment_variables" */
  updateEnvironmentVariable?: Maybe<EnvironmentVariables>;
  /** update data of the table: "environment_variables" */
  updateEnvironmentVariables?: Maybe<EnvironmentVariables_Mutation_Response>;
  /** update single row of the table: "feature_flags" */
  updateFeatureFlag?: Maybe<FeatureFlags>;
  /** update data of the table: "feature_flags" */
  updateFeatureFlags?: Maybe<FeatureFlags_Mutation_Response>;
  /** update data of the table: "feedback" */
  updateFeedback?: Maybe<Feedback_Mutation_Response>;
  /** update single row of the table: "feedback" */
  updateFeedbackOne?: Maybe<Feedback>;
  /** update single row of the table: "storage.files" */
  updateFile?: Maybe<Files>;
  /** update data of the table: "storage.files" */
  updateFiles?: Maybe<Files_Mutation_Response>;
  /** update single row of the table: "github_app_installations" */
  updateGithubAppInstallation?: Maybe<GithubAppInstallations>;
  /** update data of the table: "github_app_installations" */
  updateGithubAppInstallations?: Maybe<GithubAppInstallations_Mutation_Response>;
  /** update data of the table: "github_repositories" */
  updateGithubRepositories?: Maybe<GithubRepositories_Mutation_Response>;
  /** update single row of the table: "github_repositories" */
  updateGithubRepository?: Maybe<GithubRepositories>;
  /** update single row of the table: "payment_methods" */
  updatePaymentMethod?: Maybe<PaymentMethods>;
  /** update data of the table: "payment_methods" */
  updatePaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  /** update single row of the table: "plans" */
  updatePlan?: Maybe<Plans>;
  /** update data of the table: "plans" */
  updatePlans?: Maybe<Plans_Mutation_Response>;
  /** update single row of the table: "auth.users" */
  updateUser?: Maybe<Users>;
  /** update data of the table: "auth.users" */
  updateUsers?: Maybe<Users_Mutation_Response>;
  /** update single row of the table: "workspaces" */
  updateWorkspace?: Maybe<Workspaces>;
  /** update single row of the table: "workspace_members" */
  updateWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** update single row of the table: "workspace_member_invites" */
  updateWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** update data of the table: "workspace_member_invites" */
  updateWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** update data of the table: "workspace_members" */
  updateWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** update data of the table: "workspaces" */
  updateWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  /** update multiples rows of table: "app_state_history" */
  update_appStateHistory_many?: Maybe<Array<Maybe<AppStateHistory_Mutation_Response>>>;
  /** update multiples rows of table: "app_states" */
  update_appStates_many?: Maybe<Array<Maybe<AppStates_Mutation_Response>>>;
  /** update multiples rows of table: "apps" */
  update_apps_many?: Maybe<Array<Maybe<Apps_Mutation_Response>>>;
  /** update multiples rows of table: "auth.provider_requests" */
  update_authProviderRequests_many?: Maybe<Array<Maybe<AuthProviderRequests_Mutation_Response>>>;
  /** update multiples rows of table: "auth.providers" */
  update_authProviders_many?: Maybe<Array<Maybe<AuthProviders_Mutation_Response>>>;
  /** update multiples rows of table: "auth.refresh_tokens" */
  update_authRefreshTokens_many?: Maybe<Array<Maybe<AuthRefreshTokens_Mutation_Response>>>;
  /** update multiples rows of table: "auth.roles" */
  update_authRoles_many?: Maybe<Array<Maybe<AuthRoles_Mutation_Response>>>;
  /** update multiples rows of table: "auth.user_providers" */
  update_authUserProviders_many?: Maybe<Array<Maybe<AuthUserProviders_Mutation_Response>>>;
  /** update multiples rows of table: "auth.user_roles" */
  update_authUserRoles_many?: Maybe<Array<Maybe<AuthUserRoles_Mutation_Response>>>;
  /** update multiples rows of table: "auth.user_security_keys" */
  update_authUserSecurityKeys_many?: Maybe<Array<Maybe<AuthUserSecurityKeys_Mutation_Response>>>;
  /** update data of the table: "auth.migrations" */
  update_auth_migrations?: Maybe<Auth_Migrations_Mutation_Response>;
  /** update single row of the table: "auth.migrations" */
  update_auth_migrations_by_pk?: Maybe<Auth_Migrations>;
  /** update multiples rows of table: "auth.migrations" */
  update_auth_migrations_many?: Maybe<Array<Maybe<Auth_Migrations_Mutation_Response>>>;
  /** update multiples rows of table: "backups" */
  update_backups_many?: Maybe<Array<Maybe<Backups_Mutation_Response>>>;
  /** update multiples rows of table: "storage.buckets" */
  update_buckets_many?: Maybe<Array<Maybe<Buckets_Mutation_Response>>>;
  /** update multiples rows of table: "cli_tokens" */
  update_cliTokens_many?: Maybe<Array<Maybe<CliTokens_Mutation_Response>>>;
  /** update data of the table: "continents" */
  update_continents?: Maybe<Continents_Mutation_Response>;
  /** update single row of the table: "continents" */
  update_continents_by_pk?: Maybe<Continents>;
  /** update multiples rows of table: "continents" */
  update_continents_many?: Maybe<Array<Maybe<Continents_Mutation_Response>>>;
  /** update data of the table: "countries" */
  update_countries?: Maybe<Countries_Mutation_Response>;
  /** update single row of the table: "countries" */
  update_countries_by_pk?: Maybe<Countries>;
  /** update multiples rows of table: "countries" */
  update_countries_many?: Maybe<Array<Maybe<Countries_Mutation_Response>>>;
  /** update multiples rows of table: "deployment_logs" */
  update_deploymentLogs_many?: Maybe<Array<Maybe<DeploymentLogs_Mutation_Response>>>;
  /** update multiples rows of table: "deployments" */
  update_deployments_many?: Maybe<Array<Maybe<Deployments_Mutation_Response>>>;
  /** update multiples rows of table: "environment_variables" */
  update_environmentVariables_many?: Maybe<Array<Maybe<EnvironmentVariables_Mutation_Response>>>;
  /** update multiples rows of table: "feature_flags" */
  update_featureFlags_many?: Maybe<Array<Maybe<FeatureFlags_Mutation_Response>>>;
  /** update multiples rows of table: "feedback" */
  update_feedback_many?: Maybe<Array<Maybe<Feedback_Mutation_Response>>>;
  /** update multiples rows of table: "storage.files" */
  update_files_many?: Maybe<Array<Maybe<Files_Mutation_Response>>>;
  /** update multiples rows of table: "github_app_installations" */
  update_githubAppInstallations_many?: Maybe<Array<Maybe<GithubAppInstallations_Mutation_Response>>>;
  /** update multiples rows of table: "github_repositories" */
  update_githubRepositories_many?: Maybe<Array<Maybe<GithubRepositories_Mutation_Response>>>;
  /** update multiples rows of table: "payment_methods" */
  update_paymentMethods_many?: Maybe<Array<Maybe<PaymentMethods_Mutation_Response>>>;
  /** update multiples rows of table: "plans" */
  update_plans_many?: Maybe<Array<Maybe<Plans_Mutation_Response>>>;
  /** update data of the table: "regions" */
  update_regions?: Maybe<Regions_Mutation_Response>;
  /** update single row of the table: "regions" */
  update_regions_by_pk?: Maybe<Regions>;
  /** update multiples rows of table: "regions" */
  update_regions_many?: Maybe<Array<Maybe<Regions_Mutation_Response>>>;
  /** update multiples rows of table: "auth.users" */
  update_users_many?: Maybe<Array<Maybe<Users_Mutation_Response>>>;
  /** update multiples rows of table: "workspace_member_invites" */
  update_workspaceMemberInvites_many?: Maybe<Array<Maybe<WorkspaceMemberInvites_Mutation_Response>>>;
  /** update multiples rows of table: "workspace_members" */
  update_workspaceMembers_many?: Maybe<Array<Maybe<WorkspaceMembers_Mutation_Response>>>;
  /** update multiples rows of table: "workspaces" */
  update_workspaces_many?: Maybe<Array<Maybe<Workspaces_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootBackupApplicationDatabaseArgs = {
  appID: Scalars['String'];
};


/** mutation root */
export type Mutation_RootCreateDatabaseBackupArgs = {
  appId: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAppArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAppStateArgs = {
  id: Scalars['Int'];
};


/** mutation root */
export type Mutation_RootDeleteAppStateHistoriesArgs = {
  where: AppStateHistory_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAppStateHistoryArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAppStatesArgs = {
  where: AppStates_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAppsArgs = {
  where: Apps_Bool_Exp;
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
export type Mutation_RootDeleteAuthUserSecurityKeyArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthUserSecurityKeysArgs = {
  where: AuthUserSecurityKeys_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteBackupArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteBackupsArgs = {
  where: Backups_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteBucketArgs = {
  id: Scalars['String'];
};


/** mutation root */
export type Mutation_RootDeleteBucketsArgs = {
  where: Buckets_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteCliTokenArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteCliTokensArgs = {
  where: CliTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteDeploymentArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteDeploymentLogArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteDeploymentLogsArgs = {
  where: DeploymentLogs_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteDeploymentsArgs = {
  where: Deployments_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteEnvironmentVariableArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteEnvironmentVariablesArgs = {
  where: EnvironmentVariables_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteFeatureFlagArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteFeatureFlagsArgs = {
  where: FeatureFlags_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteFeedbackArgs = {
  where: Feedback_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteFeedbackOneArgs = {
  id: Scalars['Int'];
};


/** mutation root */
export type Mutation_RootDeleteFileArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteFilesArgs = {
  where: Files_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteGithubAppInstallationArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteGithubAppInstallationsArgs = {
  where: GithubAppInstallations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteGithubRepositoriesArgs = {
  where: GithubRepositories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteGithubRepositoryArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeletePaymentMethodArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeletePaymentMethodsArgs = {
  where: PaymentMethods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeletePlanArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeletePlansArgs = {
  where: Plans_Bool_Exp;
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
export type Mutation_RootDeleteWorkspaceArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberInvitesArgs = {
  where: WorkspaceMemberInvites_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMembersArgs = {
  where: WorkspaceMembers_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkspacesArgs = {
  where: Workspaces_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Auth_MigrationsArgs = {
  where: Auth_Migrations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Auth_Migrations_By_PkArgs = {
  id: Scalars['Int'];
};


/** mutation root */
export type Mutation_RootDelete_ContinentsArgs = {
  where: Continents_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Continents_By_PkArgs = {
  code: Scalars['bpchar'];
};


/** mutation root */
export type Mutation_RootDelete_CountriesArgs = {
  where: Countries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Countries_By_PkArgs = {
  code: Scalars['bpchar'];
};


/** mutation root */
export type Mutation_RootDelete_RegionsArgs = {
  where: Regions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDelete_Regions_By_PkArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootInsertAppArgs = {
  object: Apps_Insert_Input;
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppStateArgs = {
  object: AppStates_Insert_Input;
  on_conflict?: InputMaybe<AppStates_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppStateHistoriesArgs = {
  objects: Array<AppStateHistory_Insert_Input>;
  on_conflict?: InputMaybe<AppStateHistory_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppStateHistoryArgs = {
  object: AppStateHistory_Insert_Input;
  on_conflict?: InputMaybe<AppStateHistory_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppStatesArgs = {
  objects: Array<AppStates_Insert_Input>;
  on_conflict?: InputMaybe<AppStates_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppsArgs = {
  objects: Array<Apps_Insert_Input>;
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderArgs = {
  object: AuthProviders_Insert_Input;
  on_conflict?: InputMaybe<AuthProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderRequestArgs = {
  object: AuthProviderRequests_Insert_Input;
  on_conflict?: InputMaybe<AuthProviderRequests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProviderRequestsArgs = {
  objects: Array<AuthProviderRequests_Insert_Input>;
  on_conflict?: InputMaybe<AuthProviderRequests_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthProvidersArgs = {
  objects: Array<AuthProviders_Insert_Input>;
  on_conflict?: InputMaybe<AuthProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRefreshTokenArgs = {
  object: AuthRefreshTokens_Insert_Input;
  on_conflict?: InputMaybe<AuthRefreshTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRefreshTokensArgs = {
  objects: Array<AuthRefreshTokens_Insert_Input>;
  on_conflict?: InputMaybe<AuthRefreshTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRoleArgs = {
  object: AuthRoles_Insert_Input;
  on_conflict?: InputMaybe<AuthRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthRolesArgs = {
  objects: Array<AuthRoles_Insert_Input>;
  on_conflict?: InputMaybe<AuthRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserProviderArgs = {
  object: AuthUserProviders_Insert_Input;
  on_conflict?: InputMaybe<AuthUserProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserProvidersArgs = {
  objects: Array<AuthUserProviders_Insert_Input>;
  on_conflict?: InputMaybe<AuthUserProviders_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserRoleArgs = {
  object: AuthUserRoles_Insert_Input;
  on_conflict?: InputMaybe<AuthUserRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserRolesArgs = {
  objects: Array<AuthUserRoles_Insert_Input>;
  on_conflict?: InputMaybe<AuthUserRoles_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserSecurityKeyArgs = {
  object: AuthUserSecurityKeys_Insert_Input;
  on_conflict?: InputMaybe<AuthUserSecurityKeys_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAuthUserSecurityKeysArgs = {
  objects: Array<AuthUserSecurityKeys_Insert_Input>;
  on_conflict?: InputMaybe<AuthUserSecurityKeys_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertBackupArgs = {
  object: Backups_Insert_Input;
  on_conflict?: InputMaybe<Backups_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertBackupsArgs = {
  objects: Array<Backups_Insert_Input>;
  on_conflict?: InputMaybe<Backups_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertBucketArgs = {
  object: Buckets_Insert_Input;
  on_conflict?: InputMaybe<Buckets_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertBucketsArgs = {
  objects: Array<Buckets_Insert_Input>;
  on_conflict?: InputMaybe<Buckets_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertCliTokenArgs = {
  object: CliTokens_Insert_Input;
  on_conflict?: InputMaybe<CliTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertCliTokensArgs = {
  objects: Array<CliTokens_Insert_Input>;
  on_conflict?: InputMaybe<CliTokens_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentArgs = {
  object: Deployments_Insert_Input;
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentLogArgs = {
  object: DeploymentLogs_Insert_Input;
  on_conflict?: InputMaybe<DeploymentLogs_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentLogsArgs = {
  objects: Array<DeploymentLogs_Insert_Input>;
  on_conflict?: InputMaybe<DeploymentLogs_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentsArgs = {
  objects: Array<Deployments_Insert_Input>;
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertEnvironmentVariableArgs = {
  object: EnvironmentVariables_Insert_Input;
  on_conflict?: InputMaybe<EnvironmentVariables_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertEnvironmentVariablesArgs = {
  objects: Array<EnvironmentVariables_Insert_Input>;
  on_conflict?: InputMaybe<EnvironmentVariables_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeatureFlagArgs = {
  object: FeatureFlags_Insert_Input;
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeatureFlagsArgs = {
  objects: Array<FeatureFlags_Insert_Input>;
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeedbackArgs = {
  objects: Array<Feedback_Insert_Input>;
  on_conflict?: InputMaybe<Feedback_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeedbackOneArgs = {
  object: Feedback_Insert_Input;
  on_conflict?: InputMaybe<Feedback_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFileArgs = {
  object: Files_Insert_Input;
  on_conflict?: InputMaybe<Files_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFilesArgs = {
  objects: Array<Files_Insert_Input>;
  on_conflict?: InputMaybe<Files_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubAppInstallationArgs = {
  object: GithubAppInstallations_Insert_Input;
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubAppInstallationsArgs = {
  objects: Array<GithubAppInstallations_Insert_Input>;
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubRepositoriesArgs = {
  objects: Array<GithubRepositories_Insert_Input>;
  on_conflict?: InputMaybe<GithubRepositories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubRepositoryArgs = {
  object: GithubRepositories_Insert_Input;
  on_conflict?: InputMaybe<GithubRepositories_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPaymentMethodArgs = {
  object: PaymentMethods_Insert_Input;
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPaymentMethodsArgs = {
  objects: Array<PaymentMethods_Insert_Input>;
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPlanArgs = {
  object: Plans_Insert_Input;
  on_conflict?: InputMaybe<Plans_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPlansArgs = {
  objects: Array<Plans_Insert_Input>;
  on_conflict?: InputMaybe<Plans_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertUserArgs = {
  object: Users_Insert_Input;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertUsersArgs = {
  objects: Array<Users_Insert_Input>;
  on_conflict?: InputMaybe<Users_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceArgs = {
  object: Workspaces_Insert_Input;
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberArgs = {
  object: WorkspaceMembers_Insert_Input;
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberInviteArgs = {
  object: WorkspaceMemberInvites_Insert_Input;
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberInvitesArgs = {
  objects: Array<WorkspaceMemberInvites_Insert_Input>;
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMembersArgs = {
  objects: Array<WorkspaceMembers_Insert_Input>;
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspacesArgs = {
  objects: Array<Workspaces_Insert_Input>;
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Auth_MigrationsArgs = {
  objects: Array<Auth_Migrations_Insert_Input>;
  on_conflict?: InputMaybe<Auth_Migrations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Auth_Migrations_OneArgs = {
  object: Auth_Migrations_Insert_Input;
  on_conflict?: InputMaybe<Auth_Migrations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_ContinentsArgs = {
  objects: Array<Continents_Insert_Input>;
  on_conflict?: InputMaybe<Continents_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Continents_OneArgs = {
  object: Continents_Insert_Input;
  on_conflict?: InputMaybe<Continents_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_CountriesArgs = {
  objects: Array<Countries_Insert_Input>;
  on_conflict?: InputMaybe<Countries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Countries_OneArgs = {
  object: Countries_Insert_Input;
  on_conflict?: InputMaybe<Countries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_RegionsArgs = {
  objects: Array<Regions_Insert_Input>;
  on_conflict?: InputMaybe<Regions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsert_Regions_OneArgs = {
  object: Regions_Insert_Input;
  on_conflict?: InputMaybe<Regions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootMigrateRdsToPostgresArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
};


/** mutation root */
export type Mutation_RootPauseInactiveAppsArgs = {
  maxAppsToPause?: InputMaybe<Scalars['Int']>;
};


/** mutation root */
export type Mutation_RootResetPostgresPasswordArgs = {
  appID: Scalars['String'];
  newPassword: Scalars['String'];
};


/** mutation root */
export type Mutation_RootRestoreApplicationDatabaseArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
};


/** mutation root */
export type Mutation_RootRestoreDatabaseBackupArgs = {
  appId: Scalars['uuid'];
  backupId: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootScheduleCreateDatabaseBackupArgs = {
  appId?: InputMaybe<Scalars['uuid']>;
};


/** mutation root */
export type Mutation_RootSchedulePauseInactiveTenantsArgs = {
  maxAppsToPause?: InputMaybe<Scalars['Int']>;
};


/** mutation root */
export type Mutation_RootScheduleRestoreDatabaseBackupArgs = {
  appId: Scalars['uuid'];
  backupId: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootUpdateAppArgs = {
  _append?: InputMaybe<Apps_Append_Input>;
  _delete_at_path?: InputMaybe<Apps_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Apps_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Apps_Delete_Key_Input>;
  _inc?: InputMaybe<Apps_Inc_Input>;
  _prepend?: InputMaybe<Apps_Prepend_Input>;
  _set?: InputMaybe<Apps_Set_Input>;
  pk_columns: Apps_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAppStateArgs = {
  _inc?: InputMaybe<AppStates_Inc_Input>;
  _set?: InputMaybe<AppStates_Set_Input>;
  pk_columns: AppStates_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAppStateHistoriesArgs = {
  _inc?: InputMaybe<AppStateHistory_Inc_Input>;
  _set?: InputMaybe<AppStateHistory_Set_Input>;
  where: AppStateHistory_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAppStateHistoryArgs = {
  _inc?: InputMaybe<AppStateHistory_Inc_Input>;
  _set?: InputMaybe<AppStateHistory_Set_Input>;
  pk_columns: AppStateHistory_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAppStatesArgs = {
  _inc?: InputMaybe<AppStates_Inc_Input>;
  _set?: InputMaybe<AppStates_Set_Input>;
  where: AppStates_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAppsArgs = {
  _append?: InputMaybe<Apps_Append_Input>;
  _delete_at_path?: InputMaybe<Apps_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Apps_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Apps_Delete_Key_Input>;
  _inc?: InputMaybe<Apps_Inc_Input>;
  _prepend?: InputMaybe<Apps_Prepend_Input>;
  _set?: InputMaybe<Apps_Set_Input>;
  where: Apps_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderArgs = {
  _set?: InputMaybe<AuthProviders_Set_Input>;
  pk_columns: AuthProviders_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderRequestArgs = {
  _append?: InputMaybe<AuthProviderRequests_Append_Input>;
  _delete_at_path?: InputMaybe<AuthProviderRequests_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<AuthProviderRequests_Delete_Elem_Input>;
  _delete_key?: InputMaybe<AuthProviderRequests_Delete_Key_Input>;
  _prepend?: InputMaybe<AuthProviderRequests_Prepend_Input>;
  _set?: InputMaybe<AuthProviderRequests_Set_Input>;
  pk_columns: AuthProviderRequests_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthProviderRequestsArgs = {
  _append?: InputMaybe<AuthProviderRequests_Append_Input>;
  _delete_at_path?: InputMaybe<AuthProviderRequests_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<AuthProviderRequests_Delete_Elem_Input>;
  _delete_key?: InputMaybe<AuthProviderRequests_Delete_Key_Input>;
  _prepend?: InputMaybe<AuthProviderRequests_Prepend_Input>;
  _set?: InputMaybe<AuthProviderRequests_Set_Input>;
  where: AuthProviderRequests_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthProvidersArgs = {
  _set?: InputMaybe<AuthProviders_Set_Input>;
  where: AuthProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthRefreshTokenArgs = {
  _set?: InputMaybe<AuthRefreshTokens_Set_Input>;
  pk_columns: AuthRefreshTokens_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthRefreshTokensArgs = {
  _set?: InputMaybe<AuthRefreshTokens_Set_Input>;
  where: AuthRefreshTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthRoleArgs = {
  _set?: InputMaybe<AuthRoles_Set_Input>;
  pk_columns: AuthRoles_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthRolesArgs = {
  _set?: InputMaybe<AuthRoles_Set_Input>;
  where: AuthRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserProviderArgs = {
  _set?: InputMaybe<AuthUserProviders_Set_Input>;
  pk_columns: AuthUserProviders_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserProvidersArgs = {
  _set?: InputMaybe<AuthUserProviders_Set_Input>;
  where: AuthUserProviders_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserRoleArgs = {
  _set?: InputMaybe<AuthUserRoles_Set_Input>;
  pk_columns: AuthUserRoles_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserRolesArgs = {
  _set?: InputMaybe<AuthUserRoles_Set_Input>;
  where: AuthUserRoles_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserSecurityKeyArgs = {
  _inc?: InputMaybe<AuthUserSecurityKeys_Inc_Input>;
  _set?: InputMaybe<AuthUserSecurityKeys_Set_Input>;
  pk_columns: AuthUserSecurityKeys_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAuthUserSecurityKeysArgs = {
  _inc?: InputMaybe<AuthUserSecurityKeys_Inc_Input>;
  _set?: InputMaybe<AuthUserSecurityKeys_Set_Input>;
  where: AuthUserSecurityKeys_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateBackupArgs = {
  _inc?: InputMaybe<Backups_Inc_Input>;
  _set?: InputMaybe<Backups_Set_Input>;
  pk_columns: Backups_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateBackupsArgs = {
  _inc?: InputMaybe<Backups_Inc_Input>;
  _set?: InputMaybe<Backups_Set_Input>;
  where: Backups_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateBucketArgs = {
  _inc?: InputMaybe<Buckets_Inc_Input>;
  _set?: InputMaybe<Buckets_Set_Input>;
  pk_columns: Buckets_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateBucketsArgs = {
  _inc?: InputMaybe<Buckets_Inc_Input>;
  _set?: InputMaybe<Buckets_Set_Input>;
  where: Buckets_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateCliTokenArgs = {
  _set?: InputMaybe<CliTokens_Set_Input>;
  pk_columns: CliTokens_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateCliTokensArgs = {
  _set?: InputMaybe<CliTokens_Set_Input>;
  where: CliTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateDeploymentArgs = {
  _set?: InputMaybe<Deployments_Set_Input>;
  pk_columns: Deployments_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateDeploymentLogArgs = {
  _set?: InputMaybe<DeploymentLogs_Set_Input>;
  pk_columns: DeploymentLogs_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateDeploymentLogsArgs = {
  _set?: InputMaybe<DeploymentLogs_Set_Input>;
  where: DeploymentLogs_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateDeploymentsArgs = {
  _set?: InputMaybe<Deployments_Set_Input>;
  where: Deployments_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateEnvironmentVariableArgs = {
  _set?: InputMaybe<EnvironmentVariables_Set_Input>;
  pk_columns: EnvironmentVariables_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateEnvironmentVariablesArgs = {
  _set?: InputMaybe<EnvironmentVariables_Set_Input>;
  where: EnvironmentVariables_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateFeatureFlagArgs = {
  _set?: InputMaybe<FeatureFlags_Set_Input>;
  pk_columns: FeatureFlags_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateFeatureFlagsArgs = {
  _set?: InputMaybe<FeatureFlags_Set_Input>;
  where: FeatureFlags_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateFeedbackArgs = {
  _inc?: InputMaybe<Feedback_Inc_Input>;
  _set?: InputMaybe<Feedback_Set_Input>;
  where: Feedback_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateFeedbackOneArgs = {
  _inc?: InputMaybe<Feedback_Inc_Input>;
  _set?: InputMaybe<Feedback_Set_Input>;
  pk_columns: Feedback_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateFileArgs = {
  _inc?: InputMaybe<Files_Inc_Input>;
  _set?: InputMaybe<Files_Set_Input>;
  pk_columns: Files_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateFilesArgs = {
  _inc?: InputMaybe<Files_Inc_Input>;
  _set?: InputMaybe<Files_Set_Input>;
  where: Files_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateGithubAppInstallationArgs = {
  _append?: InputMaybe<GithubAppInstallations_Append_Input>;
  _delete_at_path?: InputMaybe<GithubAppInstallations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<GithubAppInstallations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<GithubAppInstallations_Delete_Key_Input>;
  _inc?: InputMaybe<GithubAppInstallations_Inc_Input>;
  _prepend?: InputMaybe<GithubAppInstallations_Prepend_Input>;
  _set?: InputMaybe<GithubAppInstallations_Set_Input>;
  pk_columns: GithubAppInstallations_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateGithubAppInstallationsArgs = {
  _append?: InputMaybe<GithubAppInstallations_Append_Input>;
  _delete_at_path?: InputMaybe<GithubAppInstallations_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<GithubAppInstallations_Delete_Elem_Input>;
  _delete_key?: InputMaybe<GithubAppInstallations_Delete_Key_Input>;
  _inc?: InputMaybe<GithubAppInstallations_Inc_Input>;
  _prepend?: InputMaybe<GithubAppInstallations_Prepend_Input>;
  _set?: InputMaybe<GithubAppInstallations_Set_Input>;
  where: GithubAppInstallations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateGithubRepositoriesArgs = {
  _set?: InputMaybe<GithubRepositories_Set_Input>;
  where: GithubRepositories_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateGithubRepositoryArgs = {
  _set?: InputMaybe<GithubRepositories_Set_Input>;
  pk_columns: GithubRepositories_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdatePaymentMethodArgs = {
  _inc?: InputMaybe<PaymentMethods_Inc_Input>;
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  pk_columns: PaymentMethods_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdatePaymentMethodsArgs = {
  _inc?: InputMaybe<PaymentMethods_Inc_Input>;
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  where: PaymentMethods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdatePlanArgs = {
  _inc?: InputMaybe<Plans_Inc_Input>;
  _set?: InputMaybe<Plans_Set_Input>;
  pk_columns: Plans_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdatePlansArgs = {
  _inc?: InputMaybe<Plans_Inc_Input>;
  _set?: InputMaybe<Plans_Set_Input>;
  where: Plans_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateUserArgs = {
  _append?: InputMaybe<Users_Append_Input>;
  _delete_at_path?: InputMaybe<Users_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Users_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Users_Delete_Key_Input>;
  _prepend?: InputMaybe<Users_Prepend_Input>;
  _set?: InputMaybe<Users_Set_Input>;
  pk_columns: Users_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateUsersArgs = {
  _append?: InputMaybe<Users_Append_Input>;
  _delete_at_path?: InputMaybe<Users_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Users_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Users_Delete_Key_Input>;
  _prepend?: InputMaybe<Users_Prepend_Input>;
  _set?: InputMaybe<Users_Set_Input>;
  where: Users_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceArgs = {
  _set?: InputMaybe<Workspaces_Set_Input>;
  pk_columns: Workspaces_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberArgs = {
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  pk_columns: WorkspaceMembers_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberInviteArgs = {
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  pk_columns: WorkspaceMemberInvites_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberInvitesArgs = {
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  where: WorkspaceMemberInvites_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMembersArgs = {
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  where: WorkspaceMembers_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkspacesArgs = {
  _set?: InputMaybe<Workspaces_Set_Input>;
  where: Workspaces_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_AppStateHistory_ManyArgs = {
  updates: Array<AppStateHistory_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AppStates_ManyArgs = {
  updates: Array<AppStates_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Apps_ManyArgs = {
  updates: Array<Apps_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthProviderRequests_ManyArgs = {
  updates: Array<AuthProviderRequests_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthProviders_ManyArgs = {
  updates: Array<AuthProviders_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthRefreshTokens_ManyArgs = {
  updates: Array<AuthRefreshTokens_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthRoles_ManyArgs = {
  updates: Array<AuthRoles_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthUserProviders_ManyArgs = {
  updates: Array<AuthUserProviders_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthUserRoles_ManyArgs = {
  updates: Array<AuthUserRoles_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_AuthUserSecurityKeys_ManyArgs = {
  updates: Array<AuthUserSecurityKeys_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Auth_MigrationsArgs = {
  _inc?: InputMaybe<Auth_Migrations_Inc_Input>;
  _set?: InputMaybe<Auth_Migrations_Set_Input>;
  where: Auth_Migrations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Auth_Migrations_By_PkArgs = {
  _inc?: InputMaybe<Auth_Migrations_Inc_Input>;
  _set?: InputMaybe<Auth_Migrations_Set_Input>;
  pk_columns: Auth_Migrations_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Auth_Migrations_ManyArgs = {
  updates: Array<Auth_Migrations_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Backups_ManyArgs = {
  updates: Array<Backups_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Buckets_ManyArgs = {
  updates: Array<Buckets_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_CliTokens_ManyArgs = {
  updates: Array<CliTokens_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ContinentsArgs = {
  _set?: InputMaybe<Continents_Set_Input>;
  where: Continents_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Continents_By_PkArgs = {
  _set?: InputMaybe<Continents_Set_Input>;
  pk_columns: Continents_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Continents_ManyArgs = {
  updates: Array<Continents_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_CountriesArgs = {
  _inc?: InputMaybe<Countries_Inc_Input>;
  _set?: InputMaybe<Countries_Set_Input>;
  where: Countries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Countries_By_PkArgs = {
  _inc?: InputMaybe<Countries_Inc_Input>;
  _set?: InputMaybe<Countries_Set_Input>;
  pk_columns: Countries_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Countries_ManyArgs = {
  updates: Array<Countries_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_DeploymentLogs_ManyArgs = {
  updates: Array<DeploymentLogs_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Deployments_ManyArgs = {
  updates: Array<Deployments_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_EnvironmentVariables_ManyArgs = {
  updates: Array<EnvironmentVariables_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_FeatureFlags_ManyArgs = {
  updates: Array<FeatureFlags_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Feedback_ManyArgs = {
  updates: Array<Feedback_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Files_ManyArgs = {
  updates: Array<Files_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_GithubAppInstallations_ManyArgs = {
  updates: Array<GithubAppInstallations_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_GithubRepositories_ManyArgs = {
  updates: Array<GithubRepositories_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_PaymentMethods_ManyArgs = {
  updates: Array<PaymentMethods_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Plans_ManyArgs = {
  updates: Array<Plans_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_RegionsArgs = {
  _set?: InputMaybe<Regions_Set_Input>;
  where: Regions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Regions_By_PkArgs = {
  _set?: InputMaybe<Regions_Set_Input>;
  pk_columns: Regions_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdate_Regions_ManyArgs = {
  updates: Array<Regions_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Users_ManyArgs = {
  updates: Array<Users_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkspaceMemberInvites_ManyArgs = {
  updates: Array<WorkspaceMemberInvites_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkspaceMembers_ManyArgs = {
  updates: Array<WorkspaceMembers_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Workspaces_ManyArgs = {
  updates: Array<Workspaces_Updates>;
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

/** columns and relationships of "payment_methods" */
export type PaymentMethods = {
  __typename?: 'paymentMethods';
  addedByUserId: Scalars['uuid'];
  cardBrand: Scalars['String'];
  cardExpMonth: Scalars['Int'];
  cardExpYear: Scalars['Int'];
  cardLast4: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  isDefault: Scalars['Boolean'];
  stripePaymentMethodId: Scalars['String'];
  /** An object relationship */
  user: Users;
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** aggregated selection of "payment_methods" */
export type PaymentMethods_Aggregate = {
  __typename?: 'paymentMethods_aggregate';
  aggregate?: Maybe<PaymentMethods_Aggregate_Fields>;
  nodes: Array<PaymentMethods>;
};

export type PaymentMethods_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<PaymentMethods_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<PaymentMethods_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<PaymentMethods_Aggregate_Bool_Exp_Count>;
};

export type PaymentMethods_Aggregate_Bool_Exp_Bool_And = {
  arguments: PaymentMethods_Select_Column_PaymentMethods_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<PaymentMethods_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type PaymentMethods_Aggregate_Bool_Exp_Bool_Or = {
  arguments: PaymentMethods_Select_Column_PaymentMethods_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<PaymentMethods_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type PaymentMethods_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<PaymentMethods_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "payment_methods" */
export type PaymentMethods_Aggregate_Fields = {
  __typename?: 'paymentMethods_aggregate_fields';
  avg?: Maybe<PaymentMethods_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<PaymentMethods_Max_Fields>;
  min?: Maybe<PaymentMethods_Min_Fields>;
  stddev?: Maybe<PaymentMethods_Stddev_Fields>;
  stddev_pop?: Maybe<PaymentMethods_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<PaymentMethods_Stddev_Samp_Fields>;
  sum?: Maybe<PaymentMethods_Sum_Fields>;
  var_pop?: Maybe<PaymentMethods_Var_Pop_Fields>;
  var_samp?: Maybe<PaymentMethods_Var_Samp_Fields>;
  variance?: Maybe<PaymentMethods_Variance_Fields>;
};


/** aggregate fields of "payment_methods" */
export type PaymentMethods_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "payment_methods" */
export type PaymentMethods_Aggregate_Order_By = {
  avg?: InputMaybe<PaymentMethods_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<PaymentMethods_Max_Order_By>;
  min?: InputMaybe<PaymentMethods_Min_Order_By>;
  stddev?: InputMaybe<PaymentMethods_Stddev_Order_By>;
  stddev_pop?: InputMaybe<PaymentMethods_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<PaymentMethods_Stddev_Samp_Order_By>;
  sum?: InputMaybe<PaymentMethods_Sum_Order_By>;
  var_pop?: InputMaybe<PaymentMethods_Var_Pop_Order_By>;
  var_samp?: InputMaybe<PaymentMethods_Var_Samp_Order_By>;
  variance?: InputMaybe<PaymentMethods_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "payment_methods" */
export type PaymentMethods_Arr_Rel_Insert_Input = {
  data: Array<PaymentMethods_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};

/** aggregate avg on columns */
export type PaymentMethods_Avg_Fields = {
  __typename?: 'paymentMethods_avg_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by avg() on columns of table "payment_methods" */
export type PaymentMethods_Avg_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "payment_methods". All fields are combined with a logical 'AND'. */
export type PaymentMethods_Bool_Exp = {
  _and?: InputMaybe<Array<PaymentMethods_Bool_Exp>>;
  _not?: InputMaybe<PaymentMethods_Bool_Exp>;
  _or?: InputMaybe<Array<PaymentMethods_Bool_Exp>>;
  addedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
  cardBrand?: InputMaybe<String_Comparison_Exp>;
  cardExpMonth?: InputMaybe<Int_Comparison_Exp>;
  cardExpYear?: InputMaybe<Int_Comparison_Exp>;
  cardLast4?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isDefault?: InputMaybe<Boolean_Comparison_Exp>;
  stripePaymentMethodId?: InputMaybe<String_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "payment_methods" */
export enum PaymentMethods_Constraint {
  /** unique or primary key constraint on columns "id" */
  PaymentMethodsPkey = 'payment_methods_pkey'
}

/** input type for incrementing numeric columns in table "payment_methods" */
export type PaymentMethods_Inc_Input = {
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "payment_methods" */
export type PaymentMethods_Insert_Input = {
  addedByUserId?: InputMaybe<Scalars['uuid']>;
  cardBrand?: InputMaybe<Scalars['String']>;
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
  cardLast4?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  stripePaymentMethodId?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type PaymentMethods_Max_Fields = {
  __typename?: 'paymentMethods_max_fields';
  addedByUserId?: Maybe<Scalars['uuid']>;
  cardBrand?: Maybe<Scalars['String']>;
  cardExpMonth?: Maybe<Scalars['Int']>;
  cardExpYear?: Maybe<Scalars['Int']>;
  cardLast4?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  stripePaymentMethodId?: Maybe<Scalars['String']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "payment_methods" */
export type PaymentMethods_Max_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type PaymentMethods_Min_Fields = {
  __typename?: 'paymentMethods_min_fields';
  addedByUserId?: Maybe<Scalars['uuid']>;
  cardBrand?: Maybe<Scalars['String']>;
  cardExpMonth?: Maybe<Scalars['Int']>;
  cardExpYear?: Maybe<Scalars['Int']>;
  cardLast4?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  stripePaymentMethodId?: Maybe<Scalars['String']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "payment_methods" */
export type PaymentMethods_Min_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "payment_methods" */
export type PaymentMethods_Mutation_Response = {
  __typename?: 'paymentMethods_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<PaymentMethods>;
};

/** input type for inserting object relation for remote table "payment_methods" */
export type PaymentMethods_Obj_Rel_Insert_Input = {
  data: PaymentMethods_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};

/** on_conflict condition type for table "payment_methods" */
export type PaymentMethods_On_Conflict = {
  constraint: PaymentMethods_Constraint;
  update_columns?: Array<PaymentMethods_Update_Column>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};

/** Ordering options when selecting data from "payment_methods". */
export type PaymentMethods_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isDefault?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: payment_methods */
export type PaymentMethods_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "payment_methods" */
export enum PaymentMethods_Select_Column {
  /** column name */
  AddedByUserId = 'addedByUserId',
  /** column name */
  CardBrand = 'cardBrand',
  /** column name */
  CardExpMonth = 'cardExpMonth',
  /** column name */
  CardExpYear = 'cardExpYear',
  /** column name */
  CardLast4 = 'cardLast4',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  StripePaymentMethodId = 'stripePaymentMethodId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** select "paymentMethods_aggregate_bool_exp_bool_and_arguments_columns" columns of table "payment_methods" */
export enum PaymentMethods_Select_Column_PaymentMethods_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsDefault = 'isDefault'
}

/** select "paymentMethods_aggregate_bool_exp_bool_or_arguments_columns" columns of table "payment_methods" */
export enum PaymentMethods_Select_Column_PaymentMethods_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsDefault = 'isDefault'
}

/** input type for updating data in table "payment_methods" */
export type PaymentMethods_Set_Input = {
  addedByUserId?: InputMaybe<Scalars['uuid']>;
  cardBrand?: InputMaybe<Scalars['String']>;
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
  cardLast4?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  stripePaymentMethodId?: InputMaybe<Scalars['String']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate stddev on columns */
export type PaymentMethods_Stddev_Fields = {
  __typename?: 'paymentMethods_stddev_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by stddev() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type PaymentMethods_Stddev_Pop_Fields = {
  __typename?: 'paymentMethods_stddev_pop_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by stddev_pop() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Pop_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type PaymentMethods_Stddev_Samp_Fields = {
  __typename?: 'paymentMethods_stddev_samp_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by stddev_samp() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Samp_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "paymentMethods" */
export type PaymentMethods_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: PaymentMethods_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type PaymentMethods_Stream_Cursor_Value_Input = {
  addedByUserId?: InputMaybe<Scalars['uuid']>;
  cardBrand?: InputMaybe<Scalars['String']>;
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
  cardLast4?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  stripePaymentMethodId?: InputMaybe<Scalars['String']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate sum on columns */
export type PaymentMethods_Sum_Fields = {
  __typename?: 'paymentMethods_sum_fields';
  cardExpMonth?: Maybe<Scalars['Int']>;
  cardExpYear?: Maybe<Scalars['Int']>;
};

/** order by sum() on columns of table "payment_methods" */
export type PaymentMethods_Sum_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** update columns of table "payment_methods" */
export enum PaymentMethods_Update_Column {
  /** column name */
  AddedByUserId = 'addedByUserId',
  /** column name */
  CardBrand = 'cardBrand',
  /** column name */
  CardExpMonth = 'cardExpMonth',
  /** column name */
  CardExpYear = 'cardExpYear',
  /** column name */
  CardLast4 = 'cardLast4',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  StripePaymentMethodId = 'stripePaymentMethodId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

export type PaymentMethods_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<PaymentMethods_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  where: PaymentMethods_Bool_Exp;
};

/** aggregate var_pop on columns */
export type PaymentMethods_Var_Pop_Fields = {
  __typename?: 'paymentMethods_var_pop_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by var_pop() on columns of table "payment_methods" */
export type PaymentMethods_Var_Pop_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type PaymentMethods_Var_Samp_Fields = {
  __typename?: 'paymentMethods_var_samp_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by var_samp() on columns of table "payment_methods" */
export type PaymentMethods_Var_Samp_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type PaymentMethods_Variance_Fields = {
  __typename?: 'paymentMethods_variance_fields';
  cardExpMonth?: Maybe<Scalars['Float']>;
  cardExpYear?: Maybe<Scalars['Float']>;
};

/** order by variance() on columns of table "payment_methods" */
export type PaymentMethods_Variance_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** columns and relationships of "plans" */
export type Plans = {
  __typename?: 'plans';
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  auth_cpu_limits: Scalars['String'];
  auth_cpu_requests: Scalars['String'];
  auth_memory_limits: Scalars['String'];
  auth_memory_requests: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  featureBackupEnabled: Scalars['Boolean'];
  featureCustomDomainsEnabled: Scalars['Boolean'];
  featureCustomEmailTemplatesEnabled: Scalars['Boolean'];
  /** Weather or not to deploy email templates for git deployments */
  featureDeployEmailTemplates: Scalars['Boolean'];
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout: Scalars['Int'];
  featureMaxDbSize: Scalars['Int'];
  featureMaxFilesSize?: Maybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment: Scalars['Int'];
  hasura_cpu_limits: Scalars['String'];
  hasura_cpu_requests: Scalars['String'];
  hasura_memory_limits: Scalars['String'];
  hasura_memory_requests: Scalars['String'];
  id: Scalars['uuid'];
  isDefault: Scalars['Boolean'];
  isFree: Scalars['Boolean'];
  isPublic: Scalars['Boolean'];
  name: Scalars['String'];
  postgres_cpu_limits: Scalars['String'];
  postgres_cpu_requests: Scalars['String'];
  postgres_memory_limits: Scalars['String'];
  postgres_memory_requests: Scalars['String'];
  price: Scalars['Int'];
  sort: Scalars['Int'];
  storage_cpu_limits: Scalars['String'];
  storage_cpu_requests: Scalars['String'];
  storage_memory_limits: Scalars['String'];
  storage_memory_requests: Scalars['String'];
  stripePriceId: Scalars['String'];
  upatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "plans" */
export type PlansAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "plans" */
export type PlansApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** aggregated selection of "plans" */
export type Plans_Aggregate = {
  __typename?: 'plans_aggregate';
  aggregate?: Maybe<Plans_Aggregate_Fields>;
  nodes: Array<Plans>;
};

/** aggregate fields of "plans" */
export type Plans_Aggregate_Fields = {
  __typename?: 'plans_aggregate_fields';
  avg?: Maybe<Plans_Avg_Fields>;
  count: Scalars['Int'];
  max?: Maybe<Plans_Max_Fields>;
  min?: Maybe<Plans_Min_Fields>;
  stddev?: Maybe<Plans_Stddev_Fields>;
  stddev_pop?: Maybe<Plans_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Plans_Stddev_Samp_Fields>;
  sum?: Maybe<Plans_Sum_Fields>;
  var_pop?: Maybe<Plans_Var_Pop_Fields>;
  var_samp?: Maybe<Plans_Var_Samp_Fields>;
  variance?: Maybe<Plans_Variance_Fields>;
};


/** aggregate fields of "plans" */
export type Plans_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Plans_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** aggregate avg on columns */
export type Plans_Avg_Fields = {
  __typename?: 'plans_avg_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** Boolean expression to filter rows from the table "plans". All fields are combined with a logical 'AND'. */
export type Plans_Bool_Exp = {
  _and?: InputMaybe<Array<Plans_Bool_Exp>>;
  _not?: InputMaybe<Plans_Bool_Exp>;
  _or?: InputMaybe<Array<Plans_Bool_Exp>>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  auth_cpu_limits?: InputMaybe<String_Comparison_Exp>;
  auth_cpu_requests?: InputMaybe<String_Comparison_Exp>;
  auth_memory_limits?: InputMaybe<String_Comparison_Exp>;
  auth_memory_requests?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  featureBackupEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureCustomDomainsEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureDeployEmailTemplates?: InputMaybe<Boolean_Comparison_Exp>;
  featureFunctionExecutionTimeout?: InputMaybe<Int_Comparison_Exp>;
  featureMaxDbSize?: InputMaybe<Int_Comparison_Exp>;
  featureMaxFilesSize?: InputMaybe<Int_Comparison_Exp>;
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Int_Comparison_Exp>;
  hasura_cpu_limits?: InputMaybe<String_Comparison_Exp>;
  hasura_cpu_requests?: InputMaybe<String_Comparison_Exp>;
  hasura_memory_limits?: InputMaybe<String_Comparison_Exp>;
  hasura_memory_requests?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isDefault?: InputMaybe<Boolean_Comparison_Exp>;
  isFree?: InputMaybe<Boolean_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  postgres_cpu_limits?: InputMaybe<String_Comparison_Exp>;
  postgres_cpu_requests?: InputMaybe<String_Comparison_Exp>;
  postgres_memory_limits?: InputMaybe<String_Comparison_Exp>;
  postgres_memory_requests?: InputMaybe<String_Comparison_Exp>;
  price?: InputMaybe<Int_Comparison_Exp>;
  sort?: InputMaybe<Int_Comparison_Exp>;
  storage_cpu_limits?: InputMaybe<String_Comparison_Exp>;
  storage_cpu_requests?: InputMaybe<String_Comparison_Exp>;
  storage_memory_limits?: InputMaybe<String_Comparison_Exp>;
  storage_memory_requests?: InputMaybe<String_Comparison_Exp>;
  stripePriceId?: InputMaybe<String_Comparison_Exp>;
  upatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "plans" */
export enum Plans_Constraint {
  /** unique or primary key constraint on columns "id" */
  PlansPkey = 'plans_pkey'
}

/** input type for incrementing numeric columns in table "plans" */
export type Plans_Inc_Input = {
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: InputMaybe<Scalars['Int']>;
  featureMaxDbSize?: InputMaybe<Scalars['Int']>;
  featureMaxFilesSize?: InputMaybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Scalars['Int']>;
  price?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "plans" */
export type Plans_Insert_Input = {
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  auth_cpu_limits?: InputMaybe<Scalars['String']>;
  auth_cpu_requests?: InputMaybe<Scalars['String']>;
  auth_memory_limits?: InputMaybe<Scalars['String']>;
  auth_memory_requests?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  featureBackupEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomDomainsEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Scalars['Boolean']>;
  /** Weather or not to deploy email templates for git deployments */
  featureDeployEmailTemplates?: InputMaybe<Scalars['Boolean']>;
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: InputMaybe<Scalars['Int']>;
  featureMaxDbSize?: InputMaybe<Scalars['Int']>;
  featureMaxFilesSize?: InputMaybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Scalars['Int']>;
  hasura_cpu_limits?: InputMaybe<Scalars['String']>;
  hasura_cpu_requests?: InputMaybe<Scalars['String']>;
  hasura_memory_limits?: InputMaybe<Scalars['String']>;
  hasura_memory_requests?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  isFree?: InputMaybe<Scalars['Boolean']>;
  isPublic?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  postgres_cpu_limits?: InputMaybe<Scalars['String']>;
  postgres_cpu_requests?: InputMaybe<Scalars['String']>;
  postgres_memory_limits?: InputMaybe<Scalars['String']>;
  postgres_memory_requests?: InputMaybe<Scalars['String']>;
  price?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<Scalars['Int']>;
  storage_cpu_limits?: InputMaybe<Scalars['String']>;
  storage_cpu_requests?: InputMaybe<Scalars['String']>;
  storage_memory_limits?: InputMaybe<Scalars['String']>;
  storage_memory_requests?: InputMaybe<Scalars['String']>;
  stripePriceId?: InputMaybe<Scalars['String']>;
  upatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate max on columns */
export type Plans_Max_Fields = {
  __typename?: 'plans_max_fields';
  auth_cpu_limits?: Maybe<Scalars['String']>;
  auth_cpu_requests?: Maybe<Scalars['String']>;
  auth_memory_limits?: Maybe<Scalars['String']>;
  auth_memory_requests?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Int']>;
  featureMaxDbSize?: Maybe<Scalars['Int']>;
  featureMaxFilesSize?: Maybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Int']>;
  hasura_cpu_limits?: Maybe<Scalars['String']>;
  hasura_cpu_requests?: Maybe<Scalars['String']>;
  hasura_memory_limits?: Maybe<Scalars['String']>;
  hasura_memory_requests?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  postgres_cpu_limits?: Maybe<Scalars['String']>;
  postgres_cpu_requests?: Maybe<Scalars['String']>;
  postgres_memory_limits?: Maybe<Scalars['String']>;
  postgres_memory_requests?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['Int']>;
  sort?: Maybe<Scalars['Int']>;
  storage_cpu_limits?: Maybe<Scalars['String']>;
  storage_cpu_requests?: Maybe<Scalars['String']>;
  storage_memory_limits?: Maybe<Scalars['String']>;
  storage_memory_requests?: Maybe<Scalars['String']>;
  stripePriceId?: Maybe<Scalars['String']>;
  upatedAt?: Maybe<Scalars['timestamptz']>;
};

/** aggregate min on columns */
export type Plans_Min_Fields = {
  __typename?: 'plans_min_fields';
  auth_cpu_limits?: Maybe<Scalars['String']>;
  auth_cpu_requests?: Maybe<Scalars['String']>;
  auth_memory_limits?: Maybe<Scalars['String']>;
  auth_memory_requests?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Int']>;
  featureMaxDbSize?: Maybe<Scalars['Int']>;
  featureMaxFilesSize?: Maybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Int']>;
  hasura_cpu_limits?: Maybe<Scalars['String']>;
  hasura_cpu_requests?: Maybe<Scalars['String']>;
  hasura_memory_limits?: Maybe<Scalars['String']>;
  hasura_memory_requests?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  postgres_cpu_limits?: Maybe<Scalars['String']>;
  postgres_cpu_requests?: Maybe<Scalars['String']>;
  postgres_memory_limits?: Maybe<Scalars['String']>;
  postgres_memory_requests?: Maybe<Scalars['String']>;
  price?: Maybe<Scalars['Int']>;
  sort?: Maybe<Scalars['Int']>;
  storage_cpu_limits?: Maybe<Scalars['String']>;
  storage_cpu_requests?: Maybe<Scalars['String']>;
  storage_memory_limits?: Maybe<Scalars['String']>;
  storage_memory_requests?: Maybe<Scalars['String']>;
  stripePriceId?: Maybe<Scalars['String']>;
  upatedAt?: Maybe<Scalars['timestamptz']>;
};

/** response of any mutation on the table "plans" */
export type Plans_Mutation_Response = {
  __typename?: 'plans_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Plans>;
};

/** input type for inserting object relation for remote table "plans" */
export type Plans_Obj_Rel_Insert_Input = {
  data: Plans_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Plans_On_Conflict>;
};

/** on_conflict condition type for table "plans" */
export type Plans_On_Conflict = {
  constraint: Plans_Constraint;
  update_columns?: Array<Plans_Update_Column>;
  where?: InputMaybe<Plans_Bool_Exp>;
};

/** Ordering options when selecting data from "plans". */
export type Plans_Order_By = {
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  auth_cpu_limits?: InputMaybe<Order_By>;
  auth_cpu_requests?: InputMaybe<Order_By>;
  auth_memory_limits?: InputMaybe<Order_By>;
  auth_memory_requests?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  featureBackupEnabled?: InputMaybe<Order_By>;
  featureCustomDomainsEnabled?: InputMaybe<Order_By>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Order_By>;
  featureDeployEmailTemplates?: InputMaybe<Order_By>;
  featureFunctionExecutionTimeout?: InputMaybe<Order_By>;
  featureMaxDbSize?: InputMaybe<Order_By>;
  featureMaxFilesSize?: InputMaybe<Order_By>;
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Order_By>;
  hasura_cpu_limits?: InputMaybe<Order_By>;
  hasura_cpu_requests?: InputMaybe<Order_By>;
  hasura_memory_limits?: InputMaybe<Order_By>;
  hasura_memory_requests?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isDefault?: InputMaybe<Order_By>;
  isFree?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  postgres_cpu_limits?: InputMaybe<Order_By>;
  postgres_cpu_requests?: InputMaybe<Order_By>;
  postgres_memory_limits?: InputMaybe<Order_By>;
  postgres_memory_requests?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  sort?: InputMaybe<Order_By>;
  storage_cpu_limits?: InputMaybe<Order_By>;
  storage_cpu_requests?: InputMaybe<Order_By>;
  storage_memory_limits?: InputMaybe<Order_By>;
  storage_memory_requests?: InputMaybe<Order_By>;
  stripePriceId?: InputMaybe<Order_By>;
  upatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: plans */
export type Plans_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "plans" */
export enum Plans_Select_Column {
  /** column name */
  AuthCpuLimits = 'auth_cpu_limits',
  /** column name */
  AuthCpuRequests = 'auth_cpu_requests',
  /** column name */
  AuthMemoryLimits = 'auth_memory_limits',
  /** column name */
  AuthMemoryRequests = 'auth_memory_requests',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FeatureBackupEnabled = 'featureBackupEnabled',
  /** column name */
  FeatureCustomDomainsEnabled = 'featureCustomDomainsEnabled',
  /** column name */
  FeatureCustomEmailTemplatesEnabled = 'featureCustomEmailTemplatesEnabled',
  /** column name */
  FeatureDeployEmailTemplates = 'featureDeployEmailTemplates',
  /** column name */
  FeatureFunctionExecutionTimeout = 'featureFunctionExecutionTimeout',
  /** column name */
  FeatureMaxDbSize = 'featureMaxDbSize',
  /** column name */
  FeatureMaxFilesSize = 'featureMaxFilesSize',
  /** column name */
  FeatureMaxNumberOfFunctionsPerDeployment = 'featureMaxNumberOfFunctionsPerDeployment',
  /** column name */
  HasuraCpuLimits = 'hasura_cpu_limits',
  /** column name */
  HasuraCpuRequests = 'hasura_cpu_requests',
  /** column name */
  HasuraMemoryLimits = 'hasura_memory_limits',
  /** column name */
  HasuraMemoryRequests = 'hasura_memory_requests',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  IsFree = 'isFree',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  Name = 'name',
  /** column name */
  PostgresCpuLimits = 'postgres_cpu_limits',
  /** column name */
  PostgresCpuRequests = 'postgres_cpu_requests',
  /** column name */
  PostgresMemoryLimits = 'postgres_memory_limits',
  /** column name */
  PostgresMemoryRequests = 'postgres_memory_requests',
  /** column name */
  Price = 'price',
  /** column name */
  Sort = 'sort',
  /** column name */
  StorageCpuLimits = 'storage_cpu_limits',
  /** column name */
  StorageCpuRequests = 'storage_cpu_requests',
  /** column name */
  StorageMemoryLimits = 'storage_memory_limits',
  /** column name */
  StorageMemoryRequests = 'storage_memory_requests',
  /** column name */
  StripePriceId = 'stripePriceId',
  /** column name */
  UpatedAt = 'upatedAt'
}

/** input type for updating data in table "plans" */
export type Plans_Set_Input = {
  auth_cpu_limits?: InputMaybe<Scalars['String']>;
  auth_cpu_requests?: InputMaybe<Scalars['String']>;
  auth_memory_limits?: InputMaybe<Scalars['String']>;
  auth_memory_requests?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  featureBackupEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomDomainsEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Scalars['Boolean']>;
  /** Weather or not to deploy email templates for git deployments */
  featureDeployEmailTemplates?: InputMaybe<Scalars['Boolean']>;
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: InputMaybe<Scalars['Int']>;
  featureMaxDbSize?: InputMaybe<Scalars['Int']>;
  featureMaxFilesSize?: InputMaybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Scalars['Int']>;
  hasura_cpu_limits?: InputMaybe<Scalars['String']>;
  hasura_cpu_requests?: InputMaybe<Scalars['String']>;
  hasura_memory_limits?: InputMaybe<Scalars['String']>;
  hasura_memory_requests?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  isFree?: InputMaybe<Scalars['Boolean']>;
  isPublic?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  postgres_cpu_limits?: InputMaybe<Scalars['String']>;
  postgres_cpu_requests?: InputMaybe<Scalars['String']>;
  postgres_memory_limits?: InputMaybe<Scalars['String']>;
  postgres_memory_requests?: InputMaybe<Scalars['String']>;
  price?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<Scalars['Int']>;
  storage_cpu_limits?: InputMaybe<Scalars['String']>;
  storage_cpu_requests?: InputMaybe<Scalars['String']>;
  storage_memory_limits?: InputMaybe<Scalars['String']>;
  storage_memory_requests?: InputMaybe<Scalars['String']>;
  stripePriceId?: InputMaybe<Scalars['String']>;
  upatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate stddev on columns */
export type Plans_Stddev_Fields = {
  __typename?: 'plans_stddev_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_pop on columns */
export type Plans_Stddev_Pop_Fields = {
  __typename?: 'plans_stddev_pop_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** aggregate stddev_samp on columns */
export type Plans_Stddev_Samp_Fields = {
  __typename?: 'plans_stddev_samp_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** Streaming cursor of the table "plans" */
export type Plans_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Plans_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Plans_Stream_Cursor_Value_Input = {
  auth_cpu_limits?: InputMaybe<Scalars['String']>;
  auth_cpu_requests?: InputMaybe<Scalars['String']>;
  auth_memory_limits?: InputMaybe<Scalars['String']>;
  auth_memory_requests?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  featureBackupEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomDomainsEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Scalars['Boolean']>;
  /** Weather or not to deploy email templates for git deployments */
  featureDeployEmailTemplates?: InputMaybe<Scalars['Boolean']>;
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: InputMaybe<Scalars['Int']>;
  featureMaxDbSize?: InputMaybe<Scalars['Int']>;
  featureMaxFilesSize?: InputMaybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: InputMaybe<Scalars['Int']>;
  hasura_cpu_limits?: InputMaybe<Scalars['String']>;
  hasura_cpu_requests?: InputMaybe<Scalars['String']>;
  hasura_memory_limits?: InputMaybe<Scalars['String']>;
  hasura_memory_requests?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  isFree?: InputMaybe<Scalars['Boolean']>;
  isPublic?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  postgres_cpu_limits?: InputMaybe<Scalars['String']>;
  postgres_cpu_requests?: InputMaybe<Scalars['String']>;
  postgres_memory_limits?: InputMaybe<Scalars['String']>;
  postgres_memory_requests?: InputMaybe<Scalars['String']>;
  price?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<Scalars['Int']>;
  storage_cpu_limits?: InputMaybe<Scalars['String']>;
  storage_cpu_requests?: InputMaybe<Scalars['String']>;
  storage_memory_limits?: InputMaybe<Scalars['String']>;
  storage_memory_requests?: InputMaybe<Scalars['String']>;
  stripePriceId?: InputMaybe<Scalars['String']>;
  upatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate sum on columns */
export type Plans_Sum_Fields = {
  __typename?: 'plans_sum_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Int']>;
  featureMaxDbSize?: Maybe<Scalars['Int']>;
  featureMaxFilesSize?: Maybe<Scalars['Int']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Int']>;
  price?: Maybe<Scalars['Int']>;
  sort?: Maybe<Scalars['Int']>;
};

/** update columns of table "plans" */
export enum Plans_Update_Column {
  /** column name */
  AuthCpuLimits = 'auth_cpu_limits',
  /** column name */
  AuthCpuRequests = 'auth_cpu_requests',
  /** column name */
  AuthMemoryLimits = 'auth_memory_limits',
  /** column name */
  AuthMemoryRequests = 'auth_memory_requests',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FeatureBackupEnabled = 'featureBackupEnabled',
  /** column name */
  FeatureCustomDomainsEnabled = 'featureCustomDomainsEnabled',
  /** column name */
  FeatureCustomEmailTemplatesEnabled = 'featureCustomEmailTemplatesEnabled',
  /** column name */
  FeatureDeployEmailTemplates = 'featureDeployEmailTemplates',
  /** column name */
  FeatureFunctionExecutionTimeout = 'featureFunctionExecutionTimeout',
  /** column name */
  FeatureMaxDbSize = 'featureMaxDbSize',
  /** column name */
  FeatureMaxFilesSize = 'featureMaxFilesSize',
  /** column name */
  FeatureMaxNumberOfFunctionsPerDeployment = 'featureMaxNumberOfFunctionsPerDeployment',
  /** column name */
  HasuraCpuLimits = 'hasura_cpu_limits',
  /** column name */
  HasuraCpuRequests = 'hasura_cpu_requests',
  /** column name */
  HasuraMemoryLimits = 'hasura_memory_limits',
  /** column name */
  HasuraMemoryRequests = 'hasura_memory_requests',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  IsFree = 'isFree',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  Name = 'name',
  /** column name */
  PostgresCpuLimits = 'postgres_cpu_limits',
  /** column name */
  PostgresCpuRequests = 'postgres_cpu_requests',
  /** column name */
  PostgresMemoryLimits = 'postgres_memory_limits',
  /** column name */
  PostgresMemoryRequests = 'postgres_memory_requests',
  /** column name */
  Price = 'price',
  /** column name */
  Sort = 'sort',
  /** column name */
  StorageCpuLimits = 'storage_cpu_limits',
  /** column name */
  StorageCpuRequests = 'storage_cpu_requests',
  /** column name */
  StorageMemoryLimits = 'storage_memory_limits',
  /** column name */
  StorageMemoryRequests = 'storage_memory_requests',
  /** column name */
  StripePriceId = 'stripePriceId',
  /** column name */
  UpatedAt = 'upatedAt'
}

export type Plans_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Plans_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Plans_Set_Input>;
  where: Plans_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Plans_Var_Pop_Fields = {
  __typename?: 'plans_var_pop_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** aggregate var_samp on columns */
export type Plans_Var_Samp_Fields = {
  __typename?: 'plans_var_samp_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

/** aggregate variance on columns */
export type Plans_Variance_Fields = {
  __typename?: 'plans_variance_fields';
  /** Function execution timeout in seconds */
  featureFunctionExecutionTimeout?: Maybe<Scalars['Float']>;
  featureMaxDbSize?: Maybe<Scalars['Float']>;
  featureMaxFilesSize?: Maybe<Scalars['Float']>;
  /** Max number of functions to deploy per git deployment */
  featureMaxNumberOfFunctionsPerDeployment?: Maybe<Scalars['Float']>;
  price?: Maybe<Scalars['Float']>;
  sort?: Maybe<Scalars['Float']>;
};

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "apps" using primary key columns */
  app?: Maybe<Apps>;
  /** fetch data from the table: "app_states" using primary key columns */
  appState?: Maybe<AppStates>;
  /** fetch data from the table: "app_state_history" */
  appStateHistories: Array<AppStateHistory>;
  /** fetch data from the table: "app_state_history" using primary key columns */
  appStateHistory?: Maybe<AppStateHistory>;
  /** fetch aggregated fields from the table: "app_state_history" */
  appStateHistoryAggregate: AppStateHistory_Aggregate;
  /** fetch data from the table: "app_states" */
  appStates: Array<AppStates>;
  /** fetch aggregated fields from the table: "app_states" */
  appStatesAggregate: AppStates_Aggregate;
  /** An array relationship */
  apps: Array<Apps>;
  /** fetch aggregated fields from the table: "apps" */
  appsAggregate: Apps_Aggregate;
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
  /** fetch data from the table: "auth.user_security_keys" using primary key columns */
  authUserSecurityKey?: Maybe<AuthUserSecurityKeys>;
  /** fetch data from the table: "auth.user_security_keys" */
  authUserSecurityKeys: Array<AuthUserSecurityKeys>;
  /** fetch aggregated fields from the table: "auth.user_security_keys" */
  authUserSecurityKeysAggregate: AuthUserSecurityKeys_Aggregate;
  /** fetch data from the table: "auth.migrations" */
  auth_migrations: Array<Auth_Migrations>;
  /** fetch aggregated fields from the table: "auth.migrations" */
  auth_migrations_aggregate: Auth_Migrations_Aggregate;
  /** fetch data from the table: "auth.migrations" using primary key columns */
  auth_migrations_by_pk?: Maybe<Auth_Migrations>;
  /** fetch data from the table: "backups" using primary key columns */
  backup?: Maybe<Backups>;
  /** An array relationship */
  backups: Array<Backups>;
  /** fetch aggregated fields from the table: "backups" */
  backupsAggregate: Backups_Aggregate;
  /** fetch data from the table: "storage.buckets" using primary key columns */
  bucket?: Maybe<Buckets>;
  /** fetch data from the table: "storage.buckets" */
  buckets: Array<Buckets>;
  /** fetch aggregated fields from the table: "storage.buckets" */
  bucketsAggregate: Buckets_Aggregate;
  /** fetch data from the table: "cli_tokens" using primary key columns */
  cliToken?: Maybe<CliTokens>;
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  /** fetch aggregated fields from the table: "cli_tokens" */
  cliTokensAggregate: CliTokens_Aggregate;
  /** fetch data from the table: "continents" */
  continents: Array<Continents>;
  /** fetch aggregated fields from the table: "continents" */
  continents_aggregate: Continents_Aggregate;
  /** fetch data from the table: "continents" using primary key columns */
  continents_by_pk?: Maybe<Continents>;
  /** An array relationship */
  countries: Array<Countries>;
  /** An aggregate relationship */
  countries_aggregate: Countries_Aggregate;
  /** fetch data from the table: "countries" using primary key columns */
  countries_by_pk?: Maybe<Countries>;
  /** fetch data from the table: "deployments" using primary key columns */
  deployment?: Maybe<Deployments>;
  /** fetch data from the table: "deployment_logs" using primary key columns */
  deploymentLog?: Maybe<DeploymentLogs>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  /** fetch aggregated fields from the table: "deployment_logs" */
  deploymentLogsAggregate: DeploymentLogs_Aggregate;
  /** An array relationship */
  deployments: Array<Deployments>;
  /** fetch aggregated fields from the table: "deployments" */
  deploymentsAggregate: Deployments_Aggregate;
  /** fetch data from the table: "environment_variables" using primary key columns */
  environmentVariable?: Maybe<EnvironmentVariables>;
  /** An array relationship */
  environmentVariables: Array<EnvironmentVariables>;
  /** fetch aggregated fields from the table: "environment_variables" */
  environmentVariablesAggregate: EnvironmentVariables_Aggregate;
  /** fetch data from the table: "feature_flags" using primary key columns */
  featureFlag?: Maybe<FeatureFlags>;
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** fetch aggregated fields from the table: "feature_flags" */
  featureFlagsAggregate: FeatureFlags_Aggregate;
  /** fetch data from the table: "feedback" */
  feedback: Array<Feedback>;
  /** fetch aggregated fields from the table: "feedback" */
  feedbackAggreggate: Feedback_Aggregate;
  /** fetch data from the table: "feedback" using primary key columns */
  feedbackOne?: Maybe<Feedback>;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** An array relationship */
  files: Array<Files>;
  /** fetch aggregated fields from the table: "storage.files" */
  filesAggregate: Files_Aggregate;
  /** Function Logs */
  getFunctionLogs: Array<FunctionLogEntry>;
  /** fetch data from the table: "github_app_installations" using primary key columns */
  githubAppInstallation?: Maybe<GithubAppInstallations>;
  /** fetch data from the table: "github_app_installations" */
  githubAppInstallations: Array<GithubAppInstallations>;
  /** fetch aggregated fields from the table: "github_app_installations" */
  githubAppInstallationsAggregate: GithubAppInstallations_Aggregate;
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  /** fetch aggregated fields from the table: "github_repositories" */
  githubRepositoriesAggregate: GithubRepositories_Aggregate;
  /** fetch data from the table: "github_repositories" using primary key columns */
  githubRepository?: Maybe<GithubRepositories>;
  /** health */
  health: Health;
  listInactiveApps: Array<Scalars['uuid']>;
  /**
   * Returns logs for a given application. If `service` is not provided all services are returned.
   * If `from` and `to` are not provided, they default to an hour ago and now, respectively.
   */
  logs: Array<Log>;
  /** fetch data from the table: "payment_methods" using primary key columns */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** fetch aggregated fields from the table: "payment_methods" */
  paymentMethodsAggregate: PaymentMethods_Aggregate;
  /** fetch data from the table: "plans" using primary key columns */
  plan?: Maybe<Plans>;
  /** fetch data from the table: "plans" */
  plans: Array<Plans>;
  /** fetch aggregated fields from the table: "plans" */
  plansAggregate: Plans_Aggregate;
  /** fetch data from the table: "regions" */
  regions: Array<Regions>;
  /** fetch aggregated fields from the table: "regions" */
  regions_aggregate: Regions_Aggregate;
  /** fetch data from the table: "regions" using primary key columns */
  regions_by_pk?: Maybe<Regions>;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
  /** fetch aggregated fields from the table: "auth.users" */
  usersAggregate: Users_Aggregate;
  /** fetch data from the table: "workspaces" using primary key columns */
  workspace?: Maybe<Workspaces>;
  /** fetch data from the table: "workspace_members" using primary key columns */
  workspaceMember?: Maybe<WorkspaceMembers>;
  /** fetch data from the table: "workspace_member_invites" using primary key columns */
  workspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** fetch aggregated fields from the table: "workspace_member_invites" */
  workspaceMemberInvitesAggregate: WorkspaceMemberInvites_Aggregate;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** fetch aggregated fields from the table: "workspace_members" */
  workspaceMembersAggregate: WorkspaceMembers_Aggregate;
  /** An array relationship */
  workspaces: Array<Workspaces>;
  /** fetch aggregated fields from the table: "workspaces" */
  workspacesAggregate: Workspaces_Aggregate;
};


export type Query_RootAppArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAppStateArgs = {
  id: Scalars['Int'];
};


export type Query_RootAppStateHistoriesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Query_RootAppStateHistoryArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAppStateHistoryAggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Query_RootAppStatesArgs = {
  distinct_on?: InputMaybe<Array<AppStates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStates_Order_By>>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};


export type Query_RootAppStatesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStates_Order_By>>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};


export type Query_RootAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Query_RootAppsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Query_RootAuthProviderArgs = {
  id: Scalars['String'];
};


export type Query_RootAuthProviderRequestArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthProviderRequestsArgs = {
  distinct_on?: InputMaybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviderRequests_Order_By>>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};


export type Query_RootAuthProviderRequestsAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviderRequests_Order_By>>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};


export type Query_RootAuthProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviders_Order_By>>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};


export type Query_RootAuthProvidersAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviders_Order_By>>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};


export type Query_RootAuthRefreshTokenArgs = {
  refreshToken: Scalars['uuid'];
};


export type Query_RootAuthRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Query_RootAuthRefreshTokensAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Query_RootAuthRoleArgs = {
  role: Scalars['String'];
};


export type Query_RootAuthRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRoles_Order_By>>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};


export type Query_RootAuthRolesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRoles_Order_By>>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};


export type Query_RootAuthUserProviderArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthUserProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


export type Query_RootAuthUserProvidersAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


export type Query_RootAuthUserRoleArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthUserRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


export type Query_RootAuthUserRolesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


export type Query_RootAuthUserSecurityKeyArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthUserSecurityKeysArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


export type Query_RootAuthUserSecurityKeysAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


export type Query_RootAuth_MigrationsArgs = {
  distinct_on?: InputMaybe<Array<Auth_Migrations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Auth_Migrations_Order_By>>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};


export type Query_RootAuth_Migrations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Auth_Migrations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Auth_Migrations_Order_By>>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};


export type Query_RootAuth_Migrations_By_PkArgs = {
  id: Scalars['Int'];
};


export type Query_RootBackupArgs = {
  id: Scalars['uuid'];
};


export type Query_RootBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Query_RootBackupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Query_RootBucketArgs = {
  id: Scalars['String'];
};


export type Query_RootBucketsArgs = {
  distinct_on?: InputMaybe<Array<Buckets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Buckets_Order_By>>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};


export type Query_RootBucketsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Buckets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Buckets_Order_By>>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};


export type Query_RootCliTokenArgs = {
  id: Scalars['uuid'];
};


export type Query_RootCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Query_RootCliTokensAggregateArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Query_RootContinentsArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Query_RootContinents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Query_RootContinents_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Query_RootCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Query_RootCountries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Query_RootCountries_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Query_RootDeploymentArgs = {
  id: Scalars['uuid'];
};


export type Query_RootDeploymentLogArgs = {
  id: Scalars['uuid'];
};


export type Query_RootDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Query_RootDeploymentLogsAggregateArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Query_RootDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Query_RootDeploymentsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Query_RootEnvironmentVariableArgs = {
  id: Scalars['uuid'];
};


export type Query_RootEnvironmentVariablesArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


export type Query_RootEnvironmentVariablesAggregateArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


export type Query_RootFeatureFlagArgs = {
  id: Scalars['uuid'];
};


export type Query_RootFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Query_RootFeatureFlagsAggregateArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Query_RootFeedbackArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Query_RootFeedbackAggreggateArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Query_RootFeedbackOneArgs = {
  id: Scalars['Int'];
};


export type Query_RootFileArgs = {
  id: Scalars['uuid'];
};


export type Query_RootFilesArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Query_RootFilesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Query_RootGetFunctionLogsArgs = {
  endTime?: InputMaybe<Scalars['timestamptz']>;
  functionPaths?: InputMaybe<Array<Scalars['String']>>;
  startTime?: InputMaybe<Scalars['timestamptz']>;
  subdomain: Scalars['String'];
};


export type Query_RootGithubAppInstallationArgs = {
  id: Scalars['uuid'];
};


export type Query_RootGithubAppInstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Query_RootGithubAppInstallationsAggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Query_RootGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Query_RootGithubRepositoriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Query_RootGithubRepositoryArgs = {
  id: Scalars['uuid'];
};


export type Query_RootLogsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  service?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootPaymentMethodArgs = {
  id: Scalars['uuid'];
};


export type Query_RootPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Query_RootPaymentMethodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Query_RootPlanArgs = {
  id: Scalars['uuid'];
};


export type Query_RootPlansArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Query_RootPlansAggregateArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Query_RootRegionsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Query_RootRegions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Query_RootRegions_By_PkArgs = {
  id: Scalars['uuid'];
};


export type Query_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Query_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Query_RootUsersAggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Query_RootWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Query_RootWorkspaceMemberInvitesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Query_RootWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Query_RootWorkspaceMembersAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Query_RootWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


export type Query_RootWorkspacesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** columns and relationships of "regions" */
export type Regions = {
  __typename?: 'regions';
  active: Scalars['Boolean'];
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  awsName: Scalars['String'];
  city: Scalars['String'];
  /** An object relationship */
  country: Countries;
  countryCode: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  isGdprCompliant: Scalars['Boolean'];
  updatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "regions" */
export type RegionsAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "regions" */
export type RegionsApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** aggregated selection of "regions" */
export type Regions_Aggregate = {
  __typename?: 'regions_aggregate';
  aggregate?: Maybe<Regions_Aggregate_Fields>;
  nodes: Array<Regions>;
};

export type Regions_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Regions_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Regions_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Regions_Aggregate_Bool_Exp_Count>;
};

export type Regions_Aggregate_Bool_Exp_Bool_And = {
  arguments: Regions_Select_Column_Regions_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Regions_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Regions_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Regions_Select_Column_Regions_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Regions_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Regions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Regions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Regions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "regions" */
export type Regions_Aggregate_Fields = {
  __typename?: 'regions_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Regions_Max_Fields>;
  min?: Maybe<Regions_Min_Fields>;
};


/** aggregate fields of "regions" */
export type Regions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Regions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "regions" */
export type Regions_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Regions_Max_Order_By>;
  min?: InputMaybe<Regions_Min_Order_By>;
};

/** input type for inserting array relation for remote table "regions" */
export type Regions_Arr_Rel_Insert_Input = {
  data: Array<Regions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Regions_On_Conflict>;
};

/** Boolean expression to filter rows from the table "regions". All fields are combined with a logical 'AND'. */
export type Regions_Bool_Exp = {
  _and?: InputMaybe<Array<Regions_Bool_Exp>>;
  _not?: InputMaybe<Regions_Bool_Exp>;
  _or?: InputMaybe<Array<Regions_Bool_Exp>>;
  active?: InputMaybe<Boolean_Comparison_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  awsName?: InputMaybe<String_Comparison_Exp>;
  city?: InputMaybe<String_Comparison_Exp>;
  country?: InputMaybe<Countries_Bool_Exp>;
  countryCode?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isGdprCompliant?: InputMaybe<Boolean_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "regions" */
export enum Regions_Constraint {
  /** unique or primary key constraint on columns "id" */
  LocationsPkey = 'locations_pkey',
  /** unique or primary key constraint on columns "aws_name" */
  RegionsAwsNameKey = 'regions_aws_name_key'
}

/** input type for inserting data into table "regions" */
export type Regions_Insert_Input = {
  active?: InputMaybe<Scalars['Boolean']>;
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  awsName?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  country?: InputMaybe<Countries_Obj_Rel_Insert_Input>;
  countryCode?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isGdprCompliant?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** aggregate max on columns */
export type Regions_Max_Fields = {
  __typename?: 'regions_max_fields';
  awsName?: Maybe<Scalars['String']>;
  city?: Maybe<Scalars['String']>;
  countryCode?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "regions" */
export type Regions_Max_Order_By = {
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  countryCode?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Regions_Min_Fields = {
  __typename?: 'regions_min_fields';
  awsName?: Maybe<Scalars['String']>;
  city?: Maybe<Scalars['String']>;
  countryCode?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "regions" */
export type Regions_Min_Order_By = {
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  countryCode?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "regions" */
export type Regions_Mutation_Response = {
  __typename?: 'regions_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Regions>;
};

/** input type for inserting object relation for remote table "regions" */
export type Regions_Obj_Rel_Insert_Input = {
  data: Regions_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Regions_On_Conflict>;
};

/** on_conflict condition type for table "regions" */
export type Regions_On_Conflict = {
  constraint: Regions_Constraint;
  update_columns?: Array<Regions_Update_Column>;
  where?: InputMaybe<Regions_Bool_Exp>;
};

/** Ordering options when selecting data from "regions". */
export type Regions_Order_By = {
  active?: InputMaybe<Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  country?: InputMaybe<Countries_Order_By>;
  countryCode?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isGdprCompliant?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: regions */
export type Regions_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "regions" */
export enum Regions_Select_Column {
  /** column name */
  Active = 'active',
  /** column name */
  AwsName = 'awsName',
  /** column name */
  City = 'city',
  /** column name */
  CountryCode = 'countryCode',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsGdprCompliant = 'isGdprCompliant',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** select "regions_aggregate_bool_exp_bool_and_arguments_columns" columns of table "regions" */
export enum Regions_Select_Column_Regions_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  Active = 'active',
  /** column name */
  IsGdprCompliant = 'isGdprCompliant'
}

/** select "regions_aggregate_bool_exp_bool_or_arguments_columns" columns of table "regions" */
export enum Regions_Select_Column_Regions_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  Active = 'active',
  /** column name */
  IsGdprCompliant = 'isGdprCompliant'
}

/** input type for updating data in table "regions" */
export type Regions_Set_Input = {
  active?: InputMaybe<Scalars['Boolean']>;
  awsName?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isGdprCompliant?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** Streaming cursor of the table "regions" */
export type Regions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Regions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Regions_Stream_Cursor_Value_Input = {
  active?: InputMaybe<Scalars['Boolean']>;
  awsName?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isGdprCompliant?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** update columns of table "regions" */
export enum Regions_Update_Column {
  /** column name */
  Active = 'active',
  /** column name */
  AwsName = 'awsName',
  /** column name */
  City = 'city',
  /** column name */
  CountryCode = 'countryCode',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsGdprCompliant = 'isGdprCompliant',
  /** column name */
  UpdatedAt = 'updatedAt'
}

export type Regions_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Regions_Set_Input>;
  where: Regions_Bool_Exp;
};

/** Boolean expression to compare columns of type "smallint". All fields are combined with logical 'AND'. */
export type Smallint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['smallint']>;
  _gt?: InputMaybe<Scalars['smallint']>;
  _gte?: InputMaybe<Scalars['smallint']>;
  _in?: InputMaybe<Array<Scalars['smallint']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['smallint']>;
  _lte?: InputMaybe<Scalars['smallint']>;
  _neq?: InputMaybe<Scalars['smallint']>;
  _nin?: InputMaybe<Array<Scalars['smallint']>>;
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "apps" using primary key columns */
  app?: Maybe<Apps>;
  /** fetch data from the table: "app_states" using primary key columns */
  appState?: Maybe<AppStates>;
  /** fetch data from the table: "app_state_history" */
  appStateHistories: Array<AppStateHistory>;
  /** fetch data from the table: "app_state_history" using primary key columns */
  appStateHistory?: Maybe<AppStateHistory>;
  /** fetch aggregated fields from the table: "app_state_history" */
  appStateHistoryAggregate: AppStateHistory_Aggregate;
  /** fetch data from the table in a streaming manner: "app_state_history" */
  appStateHistory_stream: Array<AppStateHistory>;
  /** fetch data from the table: "app_states" */
  appStates: Array<AppStates>;
  /** fetch aggregated fields from the table: "app_states" */
  appStatesAggregate: AppStates_Aggregate;
  /** fetch data from the table in a streaming manner: "app_states" */
  appStates_stream: Array<AppStates>;
  /** An array relationship */
  apps: Array<Apps>;
  /** fetch aggregated fields from the table: "apps" */
  appsAggregate: Apps_Aggregate;
  /** fetch data from the table in a streaming manner: "apps" */
  apps_stream: Array<Apps>;
  /** fetch data from the table: "auth.providers" using primary key columns */
  authProvider?: Maybe<AuthProviders>;
  /** fetch data from the table: "auth.provider_requests" using primary key columns */
  authProviderRequest?: Maybe<AuthProviderRequests>;
  /** fetch data from the table: "auth.provider_requests" */
  authProviderRequests: Array<AuthProviderRequests>;
  /** fetch aggregated fields from the table: "auth.provider_requests" */
  authProviderRequestsAggregate: AuthProviderRequests_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.provider_requests" */
  authProviderRequests_stream: Array<AuthProviderRequests>;
  /** fetch data from the table: "auth.providers" */
  authProviders: Array<AuthProviders>;
  /** fetch aggregated fields from the table: "auth.providers" */
  authProvidersAggregate: AuthProviders_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.providers" */
  authProviders_stream: Array<AuthProviders>;
  /** fetch data from the table: "auth.refresh_tokens" using primary key columns */
  authRefreshToken?: Maybe<AuthRefreshTokens>;
  /** fetch data from the table: "auth.refresh_tokens" */
  authRefreshTokens: Array<AuthRefreshTokens>;
  /** fetch aggregated fields from the table: "auth.refresh_tokens" */
  authRefreshTokensAggregate: AuthRefreshTokens_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.refresh_tokens" */
  authRefreshTokens_stream: Array<AuthRefreshTokens>;
  /** fetch data from the table: "auth.roles" using primary key columns */
  authRole?: Maybe<AuthRoles>;
  /** fetch data from the table: "auth.roles" */
  authRoles: Array<AuthRoles>;
  /** fetch aggregated fields from the table: "auth.roles" */
  authRolesAggregate: AuthRoles_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.roles" */
  authRoles_stream: Array<AuthRoles>;
  /** fetch data from the table: "auth.user_providers" using primary key columns */
  authUserProvider?: Maybe<AuthUserProviders>;
  /** fetch data from the table: "auth.user_providers" */
  authUserProviders: Array<AuthUserProviders>;
  /** fetch aggregated fields from the table: "auth.user_providers" */
  authUserProvidersAggregate: AuthUserProviders_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.user_providers" */
  authUserProviders_stream: Array<AuthUserProviders>;
  /** fetch data from the table: "auth.user_roles" using primary key columns */
  authUserRole?: Maybe<AuthUserRoles>;
  /** fetch data from the table: "auth.user_roles" */
  authUserRoles: Array<AuthUserRoles>;
  /** fetch aggregated fields from the table: "auth.user_roles" */
  authUserRolesAggregate: AuthUserRoles_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.user_roles" */
  authUserRoles_stream: Array<AuthUserRoles>;
  /** fetch data from the table: "auth.user_security_keys" using primary key columns */
  authUserSecurityKey?: Maybe<AuthUserSecurityKeys>;
  /** fetch data from the table: "auth.user_security_keys" */
  authUserSecurityKeys: Array<AuthUserSecurityKeys>;
  /** fetch aggregated fields from the table: "auth.user_security_keys" */
  authUserSecurityKeysAggregate: AuthUserSecurityKeys_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.user_security_keys" */
  authUserSecurityKeys_stream: Array<AuthUserSecurityKeys>;
  /** fetch data from the table: "auth.migrations" */
  auth_migrations: Array<Auth_Migrations>;
  /** fetch aggregated fields from the table: "auth.migrations" */
  auth_migrations_aggregate: Auth_Migrations_Aggregate;
  /** fetch data from the table: "auth.migrations" using primary key columns */
  auth_migrations_by_pk?: Maybe<Auth_Migrations>;
  /** fetch data from the table in a streaming manner: "auth.migrations" */
  auth_migrations_stream: Array<Auth_Migrations>;
  /** fetch data from the table: "backups" using primary key columns */
  backup?: Maybe<Backups>;
  /** An array relationship */
  backups: Array<Backups>;
  /** fetch aggregated fields from the table: "backups" */
  backupsAggregate: Backups_Aggregate;
  /** fetch data from the table in a streaming manner: "backups" */
  backups_stream: Array<Backups>;
  /** fetch data from the table: "storage.buckets" using primary key columns */
  bucket?: Maybe<Buckets>;
  /** fetch data from the table: "storage.buckets" */
  buckets: Array<Buckets>;
  /** fetch aggregated fields from the table: "storage.buckets" */
  bucketsAggregate: Buckets_Aggregate;
  /** fetch data from the table in a streaming manner: "storage.buckets" */
  buckets_stream: Array<Buckets>;
  /** fetch data from the table: "cli_tokens" using primary key columns */
  cliToken?: Maybe<CliTokens>;
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  /** fetch aggregated fields from the table: "cli_tokens" */
  cliTokensAggregate: CliTokens_Aggregate;
  /** fetch data from the table in a streaming manner: "cli_tokens" */
  cliTokens_stream: Array<CliTokens>;
  /** fetch data from the table: "continents" */
  continents: Array<Continents>;
  /** fetch aggregated fields from the table: "continents" */
  continents_aggregate: Continents_Aggregate;
  /** fetch data from the table: "continents" using primary key columns */
  continents_by_pk?: Maybe<Continents>;
  /** fetch data from the table in a streaming manner: "continents" */
  continents_stream: Array<Continents>;
  /** An array relationship */
  countries: Array<Countries>;
  /** An aggregate relationship */
  countries_aggregate: Countries_Aggregate;
  /** fetch data from the table: "countries" using primary key columns */
  countries_by_pk?: Maybe<Countries>;
  /** fetch data from the table in a streaming manner: "countries" */
  countries_stream: Array<Countries>;
  /** fetch data from the table: "deployments" using primary key columns */
  deployment?: Maybe<Deployments>;
  /** fetch data from the table: "deployment_logs" using primary key columns */
  deploymentLog?: Maybe<DeploymentLogs>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  /** fetch aggregated fields from the table: "deployment_logs" */
  deploymentLogsAggregate: DeploymentLogs_Aggregate;
  /** fetch data from the table in a streaming manner: "deployment_logs" */
  deploymentLogs_stream: Array<DeploymentLogs>;
  /** An array relationship */
  deployments: Array<Deployments>;
  /** fetch aggregated fields from the table: "deployments" */
  deploymentsAggregate: Deployments_Aggregate;
  /** fetch data from the table in a streaming manner: "deployments" */
  deployments_stream: Array<Deployments>;
  /** fetch data from the table: "environment_variables" using primary key columns */
  environmentVariable?: Maybe<EnvironmentVariables>;
  /** An array relationship */
  environmentVariables: Array<EnvironmentVariables>;
  /** fetch aggregated fields from the table: "environment_variables" */
  environmentVariablesAggregate: EnvironmentVariables_Aggregate;
  /** fetch data from the table in a streaming manner: "environment_variables" */
  environmentVariables_stream: Array<EnvironmentVariables>;
  /** fetch data from the table: "feature_flags" using primary key columns */
  featureFlag?: Maybe<FeatureFlags>;
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** fetch aggregated fields from the table: "feature_flags" */
  featureFlagsAggregate: FeatureFlags_Aggregate;
  /** fetch data from the table in a streaming manner: "feature_flags" */
  featureFlags_stream: Array<FeatureFlags>;
  /** fetch data from the table: "feedback" */
  feedback: Array<Feedback>;
  /** fetch aggregated fields from the table: "feedback" */
  feedbackAggreggate: Feedback_Aggregate;
  /** fetch data from the table: "feedback" using primary key columns */
  feedbackOne?: Maybe<Feedback>;
  /** fetch data from the table in a streaming manner: "feedback" */
  feedback_stream: Array<Feedback>;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** An array relationship */
  files: Array<Files>;
  /** fetch aggregated fields from the table: "storage.files" */
  filesAggregate: Files_Aggregate;
  /** fetch data from the table in a streaming manner: "storage.files" */
  files_stream: Array<Files>;
  /** fetch data from the table: "github_app_installations" using primary key columns */
  githubAppInstallation?: Maybe<GithubAppInstallations>;
  /** fetch data from the table: "github_app_installations" */
  githubAppInstallations: Array<GithubAppInstallations>;
  /** fetch aggregated fields from the table: "github_app_installations" */
  githubAppInstallationsAggregate: GithubAppInstallations_Aggregate;
  /** fetch data from the table in a streaming manner: "github_app_installations" */
  githubAppInstallations_stream: Array<GithubAppInstallations>;
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  /** fetch aggregated fields from the table: "github_repositories" */
  githubRepositoriesAggregate: GithubRepositories_Aggregate;
  /** fetch data from the table in a streaming manner: "github_repositories" */
  githubRepositories_stream: Array<GithubRepositories>;
  /** fetch data from the table: "github_repositories" using primary key columns */
  githubRepository?: Maybe<GithubRepositories>;
  /**
   * Returns logs for a given application. If `service` is not provided all services are returned.
   * If `from` is not provided, it defaults to an hour ago.
   */
  logs: Array<Log>;
  /** fetch data from the table: "payment_methods" using primary key columns */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** fetch aggregated fields from the table: "payment_methods" */
  paymentMethodsAggregate: PaymentMethods_Aggregate;
  /** fetch data from the table in a streaming manner: "payment_methods" */
  paymentMethods_stream: Array<PaymentMethods>;
  /** fetch data from the table: "plans" using primary key columns */
  plan?: Maybe<Plans>;
  /** fetch data from the table: "plans" */
  plans: Array<Plans>;
  /** fetch aggregated fields from the table: "plans" */
  plansAggregate: Plans_Aggregate;
  /** fetch data from the table in a streaming manner: "plans" */
  plans_stream: Array<Plans>;
  /** fetch data from the table: "regions" */
  regions: Array<Regions>;
  /** fetch aggregated fields from the table: "regions" */
  regions_aggregate: Regions_Aggregate;
  /** fetch data from the table: "regions" using primary key columns */
  regions_by_pk?: Maybe<Regions>;
  /** fetch data from the table in a streaming manner: "regions" */
  regions_stream: Array<Regions>;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
  /** fetch aggregated fields from the table: "auth.users" */
  usersAggregate: Users_Aggregate;
  /** fetch data from the table in a streaming manner: "auth.users" */
  users_stream: Array<Users>;
  /** fetch data from the table: "workspaces" using primary key columns */
  workspace?: Maybe<Workspaces>;
  /** fetch data from the table: "workspace_members" using primary key columns */
  workspaceMember?: Maybe<WorkspaceMembers>;
  /** fetch data from the table: "workspace_member_invites" using primary key columns */
  workspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** fetch aggregated fields from the table: "workspace_member_invites" */
  workspaceMemberInvitesAggregate: WorkspaceMemberInvites_Aggregate;
  /** fetch data from the table in a streaming manner: "workspace_member_invites" */
  workspaceMemberInvites_stream: Array<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** fetch aggregated fields from the table: "workspace_members" */
  workspaceMembersAggregate: WorkspaceMembers_Aggregate;
  /** fetch data from the table in a streaming manner: "workspace_members" */
  workspaceMembers_stream: Array<WorkspaceMembers>;
  /** An array relationship */
  workspaces: Array<Workspaces>;
  /** fetch aggregated fields from the table: "workspaces" */
  workspacesAggregate: Workspaces_Aggregate;
  /** fetch data from the table in a streaming manner: "workspaces" */
  workspaces_stream: Array<Workspaces>;
};


export type Subscription_RootAppArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAppStateArgs = {
  id: Scalars['Int'];
};


export type Subscription_RootAppStateHistoriesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Subscription_RootAppStateHistoryArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAppStateHistoryAggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Subscription_RootAppStateHistory_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AppStateHistory_Stream_Cursor_Input>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Subscription_RootAppStatesArgs = {
  distinct_on?: InputMaybe<Array<AppStates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStates_Order_By>>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};


export type Subscription_RootAppStatesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AppStates_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStates_Order_By>>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};


export type Subscription_RootAppStates_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AppStates_Stream_Cursor_Input>>;
  where?: InputMaybe<AppStates_Bool_Exp>;
};


export type Subscription_RootAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Subscription_RootAppsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Subscription_RootApps_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Apps_Stream_Cursor_Input>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Subscription_RootAuthProviderArgs = {
  id: Scalars['String'];
};


export type Subscription_RootAuthProviderRequestArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthProviderRequestsArgs = {
  distinct_on?: InputMaybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviderRequests_Order_By>>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};


export type Subscription_RootAuthProviderRequestsAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthProviderRequests_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviderRequests_Order_By>>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};


export type Subscription_RootAuthProviderRequests_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthProviderRequests_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthProviderRequests_Bool_Exp>;
};


export type Subscription_RootAuthProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviders_Order_By>>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};


export type Subscription_RootAuthProvidersAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthProviders_Order_By>>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};


export type Subscription_RootAuthProviders_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthProviders_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthProviders_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokenArgs = {
  refreshToken: Scalars['uuid'];
};


export type Subscription_RootAuthRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokensAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokens_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthRefreshTokens_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRoleArgs = {
  role: Scalars['String'];
};


export type Subscription_RootAuthRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRoles_Order_By>>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};


export type Subscription_RootAuthRolesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRoles_Order_By>>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};


export type Subscription_RootAuthRoles_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthRoles_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserProviderArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthUserProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


export type Subscription_RootAuthUserProvidersAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


export type Subscription_RootAuthUserProviders_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthUserProviders_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


export type Subscription_RootAuthUserRoleArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthUserRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserRolesAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserRoles_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthUserRoles_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


export type Subscription_RootAuthUserSecurityKeyArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthUserSecurityKeysArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


export type Subscription_RootAuthUserSecurityKeysAggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


export type Subscription_RootAuthUserSecurityKeys_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthUserSecurityKeys_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


export type Subscription_RootAuth_MigrationsArgs = {
  distinct_on?: InputMaybe<Array<Auth_Migrations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Auth_Migrations_Order_By>>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};


export type Subscription_RootAuth_Migrations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Auth_Migrations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Auth_Migrations_Order_By>>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};


export type Subscription_RootAuth_Migrations_By_PkArgs = {
  id: Scalars['Int'];
};


export type Subscription_RootAuth_Migrations_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Auth_Migrations_Stream_Cursor_Input>>;
  where?: InputMaybe<Auth_Migrations_Bool_Exp>;
};


export type Subscription_RootBackupArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Subscription_RootBackupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Subscription_RootBackups_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Backups_Stream_Cursor_Input>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Subscription_RootBucketArgs = {
  id: Scalars['String'];
};


export type Subscription_RootBucketsArgs = {
  distinct_on?: InputMaybe<Array<Buckets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Buckets_Order_By>>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};


export type Subscription_RootBucketsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Buckets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Buckets_Order_By>>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};


export type Subscription_RootBuckets_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Buckets_Stream_Cursor_Input>>;
  where?: InputMaybe<Buckets_Bool_Exp>;
};


export type Subscription_RootCliTokenArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Subscription_RootCliTokensAggregateArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Subscription_RootCliTokens_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<CliTokens_Stream_Cursor_Input>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Subscription_RootContinentsArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Subscription_RootContinents_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Subscription_RootContinents_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Subscription_RootContinents_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Continents_Stream_Cursor_Input>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Subscription_RootCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Subscription_RootCountries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Subscription_RootCountries_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Subscription_RootCountries_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Countries_Stream_Cursor_Input>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Subscription_RootDeploymentArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootDeploymentLogArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Subscription_RootDeploymentLogsAggregateArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Subscription_RootDeploymentLogs_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<DeploymentLogs_Stream_Cursor_Input>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Subscription_RootDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Subscription_RootDeploymentsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Subscription_RootDeployments_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Deployments_Stream_Cursor_Input>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Subscription_RootEnvironmentVariableArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootEnvironmentVariablesArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


export type Subscription_RootEnvironmentVariablesAggregateArgs = {
  distinct_on?: InputMaybe<Array<EnvironmentVariables_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<EnvironmentVariables_Order_By>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


export type Subscription_RootEnvironmentVariables_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<EnvironmentVariables_Stream_Cursor_Input>>;
  where?: InputMaybe<EnvironmentVariables_Bool_Exp>;
};


export type Subscription_RootFeatureFlagArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Subscription_RootFeatureFlagsAggregateArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Subscription_RootFeatureFlags_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<FeatureFlags_Stream_Cursor_Input>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Subscription_RootFeedbackArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Subscription_RootFeedbackAggreggateArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Subscription_RootFeedbackOneArgs = {
  id: Scalars['Int'];
};


export type Subscription_RootFeedback_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Feedback_Stream_Cursor_Input>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Subscription_RootFileArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootFilesArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Subscription_RootFilesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Subscription_RootFiles_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Files_Stream_Cursor_Input>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Subscription_RootGithubAppInstallationArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootGithubAppInstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Subscription_RootGithubAppInstallationsAggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Subscription_RootGithubAppInstallations_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<GithubAppInstallations_Stream_Cursor_Input>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Subscription_RootGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Subscription_RootGithubRepositoriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Subscription_RootGithubRepositories_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<GithubRepositories_Stream_Cursor_Input>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Subscription_RootGithubRepositoryArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootLogsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  service?: InputMaybe<Scalars['String']>;
};


export type Subscription_RootPaymentMethodArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Subscription_RootPaymentMethodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Subscription_RootPaymentMethods_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<PaymentMethods_Stream_Cursor_Input>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Subscription_RootPlanArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootPlansArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Subscription_RootPlansAggregateArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Subscription_RootPlans_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Plans_Stream_Cursor_Input>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Subscription_RootRegionsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Subscription_RootRegions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Subscription_RootRegions_By_PkArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootRegions_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Regions_Stream_Cursor_Input>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Subscription_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootUsersAggregateArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootUsers_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Users_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Subscription_RootWorkspaceMemberInvitesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Subscription_RootWorkspaceMemberInvites_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<WorkspaceMemberInvites_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Subscription_RootWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Subscription_RootWorkspaceMembersAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Subscription_RootWorkspaceMembers_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<WorkspaceMembers_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Subscription_RootWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


export type Subscription_RootWorkspacesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


export type Subscription_RootWorkspaces_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Workspaces_Stream_Cursor_Input>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** Boolean expression to compare columns of type "timestamp". All fields are combined with logical 'AND'. */
export type Timestamp_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamp']>;
  _gt?: InputMaybe<Scalars['timestamp']>;
  _gte?: InputMaybe<Scalars['timestamp']>;
  _in?: InputMaybe<Array<Scalars['timestamp']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['timestamp']>;
  _lte?: InputMaybe<Scalars['timestamp']>;
  _neq?: InputMaybe<Scalars['timestamp']>;
  _nin?: InputMaybe<Array<Scalars['timestamp']>>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
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

/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type Users = {
  __typename?: 'users';
  activeMfaType?: Maybe<Scalars['String']>;
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  avatarUrl: Scalars['String'];
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  /** An aggregate relationship */
  cliTokens_aggregate: CliTokens_Aggregate;
  createdAt: Scalars['timestamptz'];
  /** An array relationship */
  creatorOfWorkspaces: Array<Workspaces>;
  /** An aggregate relationship */
  creatorOfWorkspaces_aggregate: Workspaces_Aggregate;
  currentChallenge?: Maybe<Scalars['String']>;
  defaultRole: Scalars['String'];
  /** An object relationship */
  defaultRoleByRole: AuthRoles;
  disabled: Scalars['Boolean'];
  displayName: Scalars['String'];
  email?: Maybe<Scalars['citext']>;
  emailVerified: Scalars['Boolean'];
  /** An array relationship */
  feedbacks: Array<Feedback>;
  /** An aggregate relationship */
  feedbacks_aggregate: Feedback_Aggregate;
  /** An array relationship */
  github_app_installations: Array<GithubAppInstallations>;
  /** An aggregate relationship */
  github_app_installations_aggregate: GithubAppInstallations_Aggregate;
  id: Scalars['uuid'];
  isAnonymous: Scalars['Boolean'];
  lastSeen?: Maybe<Scalars['timestamptz']>;
  locale: Scalars['String'];
  metadata?: Maybe<Scalars['jsonb']>;
  newEmail?: Maybe<Scalars['citext']>;
  otpHash?: Maybe<Scalars['String']>;
  otpHashExpiresAt: Scalars['timestamptz'];
  otpMethodLastUsed?: Maybe<Scalars['String']>;
  passwordHash?: Maybe<Scalars['String']>;
  /** An array relationship */
  payment_methods: Array<PaymentMethods>;
  /** An aggregate relationship */
  payment_methods_aggregate: PaymentMethods_Aggregate;
  phoneNumber?: Maybe<Scalars['String']>;
  phoneNumberVerified: Scalars['Boolean'];
  /** An array relationship */
  refreshTokens: Array<AuthRefreshTokens>;
  /** An aggregate relationship */
  refreshTokens_aggregate: AuthRefreshTokens_Aggregate;
  /** An object relationship */
  role: AuthRoles;
  /** An array relationship */
  roles: Array<AuthUserRoles>;
  /** An aggregate relationship */
  roles_aggregate: AuthUserRoles_Aggregate;
  /** An array relationship */
  securityKeys: Array<AuthUserSecurityKeys>;
  /** An aggregate relationship */
  securityKeys_aggregate: AuthUserSecurityKeys_Aggregate;
  ticket?: Maybe<Scalars['String']>;
  ticketExpiresAt: Scalars['timestamptz'];
  totpSecret?: Maybe<Scalars['String']>;
  updatedAt: Scalars['timestamptz'];
  /** An array relationship */
  userProviders: Array<AuthUserProviders>;
  /** An aggregate relationship */
  userProviders_aggregate: AuthUserProviders_Aggregate;
  /** An array relationship */
  workspaceMemberInvitesByInvitedByUserId: Array<WorkspaceMemberInvites>;
  /** An aggregate relationship */
  workspaceMemberInvitesByInvitedByUserId_aggregate: WorkspaceMemberInvites_Aggregate;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** An aggregate relationship */
  workspaceMembers_aggregate: WorkspaceMembers_Aggregate;
  /** An array relationship */
  workspace_member_invites: Array<WorkspaceMemberInvites>;
  /** An aggregate relationship */
  workspace_member_invites_aggregate: WorkspaceMemberInvites_Aggregate;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCliTokens_AggregateArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCreatorOfWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCreatorOfWorkspaces_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersFeedbacksArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersFeedbacks_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersGithub_App_InstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersGithub_App_Installations_AggregateArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersMetadataArgs = {
  path?: InputMaybe<Scalars['String']>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersPayment_MethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersPayment_Methods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRefreshTokens_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRolesArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRoles_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserRoles_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserRoles_Order_By>>;
  where?: InputMaybe<AuthUserRoles_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersSecurityKeysArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersSecurityKeys_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserSecurityKeys_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserSecurityKeys_Order_By>>;
  where?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersUserProvidersArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersUserProviders_AggregateArgs = {
  distinct_on?: InputMaybe<Array<AuthUserProviders_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthUserProviders_Order_By>>;
  where?: InputMaybe<AuthUserProviders_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMemberInvitesByInvitedByUserIdArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMemberInvitesByInvitedByUserId_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMembers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspace_Member_InvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspace_Member_Invites_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};

/** aggregated selection of "auth.users" */
export type Users_Aggregate = {
  __typename?: 'users_aggregate';
  aggregate?: Maybe<Users_Aggregate_Fields>;
  nodes: Array<Users>;
};

export type Users_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Users_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Users_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Users_Aggregate_Bool_Exp_Count>;
};

export type Users_Aggregate_Bool_Exp_Bool_And = {
  arguments: Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Users_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Users_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Users_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Users_Bool_Exp>;
  predicate: Int_Comparison_Exp;
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
  columns?: InputMaybe<Array<Users_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "auth.users" */
export type Users_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Users_Max_Order_By>;
  min?: InputMaybe<Users_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Users_Append_Input = {
  metadata?: InputMaybe<Scalars['jsonb']>;
};

/** input type for inserting array relation for remote table "auth.users" */
export type Users_Arr_Rel_Insert_Input = {
  data: Array<Users_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
export type Users_Bool_Exp = {
  _and?: InputMaybe<Array<Users_Bool_Exp>>;
  _not?: InputMaybe<Users_Bool_Exp>;
  _or?: InputMaybe<Array<Users_Bool_Exp>>;
  activeMfaType?: InputMaybe<String_Comparison_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  avatarUrl?: InputMaybe<String_Comparison_Exp>;
  cliTokens?: InputMaybe<CliTokens_Bool_Exp>;
  cliTokens_aggregate?: InputMaybe<CliTokens_Aggregate_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creatorOfWorkspaces?: InputMaybe<Workspaces_Bool_Exp>;
  creatorOfWorkspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Bool_Exp>;
  currentChallenge?: InputMaybe<String_Comparison_Exp>;
  defaultRole?: InputMaybe<String_Comparison_Exp>;
  defaultRoleByRole?: InputMaybe<AuthRoles_Bool_Exp>;
  disabled?: InputMaybe<Boolean_Comparison_Exp>;
  displayName?: InputMaybe<String_Comparison_Exp>;
  email?: InputMaybe<Citext_Comparison_Exp>;
  emailVerified?: InputMaybe<Boolean_Comparison_Exp>;
  feedbacks?: InputMaybe<Feedback_Bool_Exp>;
  feedbacks_aggregate?: InputMaybe<Feedback_Aggregate_Bool_Exp>;
  github_app_installations?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  github_app_installations_aggregate?: InputMaybe<GithubAppInstallations_Aggregate_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isAnonymous?: InputMaybe<Boolean_Comparison_Exp>;
  lastSeen?: InputMaybe<Timestamptz_Comparison_Exp>;
  locale?: InputMaybe<String_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  newEmail?: InputMaybe<Citext_Comparison_Exp>;
  otpHash?: InputMaybe<String_Comparison_Exp>;
  otpHashExpiresAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  otpMethodLastUsed?: InputMaybe<String_Comparison_Exp>;
  passwordHash?: InputMaybe<String_Comparison_Exp>;
  payment_methods?: InputMaybe<PaymentMethods_Bool_Exp>;
  payment_methods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Bool_Exp>;
  phoneNumber?: InputMaybe<String_Comparison_Exp>;
  phoneNumberVerified?: InputMaybe<Boolean_Comparison_Exp>;
  refreshTokens?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
  refreshTokens_aggregate?: InputMaybe<AuthRefreshTokens_Aggregate_Bool_Exp>;
  role?: InputMaybe<AuthRoles_Bool_Exp>;
  roles?: InputMaybe<AuthUserRoles_Bool_Exp>;
  roles_aggregate?: InputMaybe<AuthUserRoles_Aggregate_Bool_Exp>;
  securityKeys?: InputMaybe<AuthUserSecurityKeys_Bool_Exp>;
  securityKeys_aggregate?: InputMaybe<AuthUserSecurityKeys_Aggregate_Bool_Exp>;
  ticket?: InputMaybe<String_Comparison_Exp>;
  ticketExpiresAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  totpSecret?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userProviders?: InputMaybe<AuthUserProviders_Bool_Exp>;
  userProviders_aggregate?: InputMaybe<AuthUserProviders_Aggregate_Bool_Exp>;
  workspaceMemberInvitesByInvitedByUserId?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  workspaceMemberInvitesByInvitedByUserId_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Bool_Exp>;
  workspace_member_invites?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  workspace_member_invites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "auth.users" */
export enum Users_Constraint {
  /** unique or primary key constraint on columns "email" */
  UsersEmailKey = 'users_email_key',
  /** unique or primary key constraint on columns "phone_number" */
  UsersPhoneNumberKey = 'users_phone_number_key',
  /** unique or primary key constraint on columns "id" */
  UsersPkey = 'users_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Users_Delete_At_Path_Input = {
  metadata?: InputMaybe<Array<Scalars['String']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Users_Delete_Elem_Input = {
  metadata?: InputMaybe<Scalars['Int']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Users_Delete_Key_Input = {
  metadata?: InputMaybe<Scalars['String']>;
};

/** input type for inserting data into table "auth.users" */
export type Users_Insert_Input = {
  activeMfaType?: InputMaybe<Scalars['String']>;
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  avatarUrl?: InputMaybe<Scalars['String']>;
  cliTokens?: InputMaybe<CliTokens_Arr_Rel_Insert_Input>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorOfWorkspaces?: InputMaybe<Workspaces_Arr_Rel_Insert_Input>;
  currentChallenge?: InputMaybe<Scalars['String']>;
  defaultRole?: InputMaybe<Scalars['String']>;
  defaultRoleByRole?: InputMaybe<AuthRoles_Obj_Rel_Insert_Input>;
  disabled?: InputMaybe<Scalars['Boolean']>;
  displayName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['citext']>;
  emailVerified?: InputMaybe<Scalars['Boolean']>;
  feedbacks?: InputMaybe<Feedback_Arr_Rel_Insert_Input>;
  github_app_installations?: InputMaybe<GithubAppInstallations_Arr_Rel_Insert_Input>;
  id?: InputMaybe<Scalars['uuid']>;
  isAnonymous?: InputMaybe<Scalars['Boolean']>;
  lastSeen?: InputMaybe<Scalars['timestamptz']>;
  locale?: InputMaybe<Scalars['String']>;
  metadata?: InputMaybe<Scalars['jsonb']>;
  newEmail?: InputMaybe<Scalars['citext']>;
  otpHash?: InputMaybe<Scalars['String']>;
  otpHashExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: InputMaybe<Scalars['String']>;
  passwordHash?: InputMaybe<Scalars['String']>;
  payment_methods?: InputMaybe<PaymentMethods_Arr_Rel_Insert_Input>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  phoneNumberVerified?: InputMaybe<Scalars['Boolean']>;
  refreshTokens?: InputMaybe<AuthRefreshTokens_Arr_Rel_Insert_Input>;
  role?: InputMaybe<AuthRoles_Obj_Rel_Insert_Input>;
  roles?: InputMaybe<AuthUserRoles_Arr_Rel_Insert_Input>;
  securityKeys?: InputMaybe<AuthUserSecurityKeys_Arr_Rel_Insert_Input>;
  ticket?: InputMaybe<Scalars['String']>;
  ticketExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  totpSecret?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userProviders?: InputMaybe<AuthUserProviders_Arr_Rel_Insert_Input>;
  workspaceMemberInvitesByInvitedByUserId?: InputMaybe<WorkspaceMemberInvites_Arr_Rel_Insert_Input>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Arr_Rel_Insert_Input>;
  workspace_member_invites?: InputMaybe<WorkspaceMemberInvites_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Users_Max_Fields = {
  __typename?: 'users_max_fields';
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  currentChallenge?: Maybe<Scalars['String']>;
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
  activeMfaType?: InputMaybe<Order_By>;
  avatarUrl?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  currentChallenge?: InputMaybe<Order_By>;
  defaultRole?: InputMaybe<Order_By>;
  displayName?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  lastSeen?: InputMaybe<Order_By>;
  locale?: InputMaybe<Order_By>;
  newEmail?: InputMaybe<Order_By>;
  otpHash?: InputMaybe<Order_By>;
  otpHashExpiresAt?: InputMaybe<Order_By>;
  otpMethodLastUsed?: InputMaybe<Order_By>;
  passwordHash?: InputMaybe<Order_By>;
  phoneNumber?: InputMaybe<Order_By>;
  ticket?: InputMaybe<Order_By>;
  ticketExpiresAt?: InputMaybe<Order_By>;
  totpSecret?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Users_Min_Fields = {
  __typename?: 'users_min_fields';
  activeMfaType?: Maybe<Scalars['String']>;
  avatarUrl?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  currentChallenge?: Maybe<Scalars['String']>;
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
  activeMfaType?: InputMaybe<Order_By>;
  avatarUrl?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  currentChallenge?: InputMaybe<Order_By>;
  defaultRole?: InputMaybe<Order_By>;
  displayName?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  lastSeen?: InputMaybe<Order_By>;
  locale?: InputMaybe<Order_By>;
  newEmail?: InputMaybe<Order_By>;
  otpHash?: InputMaybe<Order_By>;
  otpHashExpiresAt?: InputMaybe<Order_By>;
  otpMethodLastUsed?: InputMaybe<Order_By>;
  passwordHash?: InputMaybe<Order_By>;
  phoneNumber?: InputMaybe<Order_By>;
  ticket?: InputMaybe<Order_By>;
  ticketExpiresAt?: InputMaybe<Order_By>;
  totpSecret?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
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
  /** upsert condition */
  on_conflict?: InputMaybe<Users_On_Conflict>;
};

/** on_conflict condition type for table "auth.users" */
export type Users_On_Conflict = {
  constraint: Users_Constraint;
  update_columns?: Array<Users_Update_Column>;
  where?: InputMaybe<Users_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.users". */
export type Users_Order_By = {
  activeMfaType?: InputMaybe<Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  avatarUrl?: InputMaybe<Order_By>;
  cliTokens_aggregate?: InputMaybe<CliTokens_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorOfWorkspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Order_By>;
  currentChallenge?: InputMaybe<Order_By>;
  defaultRole?: InputMaybe<Order_By>;
  defaultRoleByRole?: InputMaybe<AuthRoles_Order_By>;
  disabled?: InputMaybe<Order_By>;
  displayName?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  emailVerified?: InputMaybe<Order_By>;
  feedbacks_aggregate?: InputMaybe<Feedback_Aggregate_Order_By>;
  github_app_installations_aggregate?: InputMaybe<GithubAppInstallations_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  isAnonymous?: InputMaybe<Order_By>;
  lastSeen?: InputMaybe<Order_By>;
  locale?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  newEmail?: InputMaybe<Order_By>;
  otpHash?: InputMaybe<Order_By>;
  otpHashExpiresAt?: InputMaybe<Order_By>;
  otpMethodLastUsed?: InputMaybe<Order_By>;
  passwordHash?: InputMaybe<Order_By>;
  payment_methods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Order_By>;
  phoneNumber?: InputMaybe<Order_By>;
  phoneNumberVerified?: InputMaybe<Order_By>;
  refreshTokens_aggregate?: InputMaybe<AuthRefreshTokens_Aggregate_Order_By>;
  role?: InputMaybe<AuthRoles_Order_By>;
  roles_aggregate?: InputMaybe<AuthUserRoles_Aggregate_Order_By>;
  securityKeys_aggregate?: InputMaybe<AuthUserSecurityKeys_Aggregate_Order_By>;
  ticket?: InputMaybe<Order_By>;
  ticketExpiresAt?: InputMaybe<Order_By>;
  totpSecret?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userProviders_aggregate?: InputMaybe<AuthUserProviders_Aggregate_Order_By>;
  workspaceMemberInvitesByInvitedByUserId_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Order_By>;
  workspace_member_invites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
};

/** primary key columns input for table: auth.users */
export type Users_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Users_Prepend_Input = {
  metadata?: InputMaybe<Scalars['jsonb']>;
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

/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "auth.users" */
export enum Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  Disabled = 'disabled',
  /** column name */
  EmailVerified = 'emailVerified',
  /** column name */
  IsAnonymous = 'isAnonymous',
  /** column name */
  PhoneNumberVerified = 'phoneNumberVerified'
}

/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "auth.users" */
export enum Users_Select_Column_Users_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  Disabled = 'disabled',
  /** column name */
  EmailVerified = 'emailVerified',
  /** column name */
  IsAnonymous = 'isAnonymous',
  /** column name */
  PhoneNumberVerified = 'phoneNumberVerified'
}

/** input type for updating data in table "auth.users" */
export type Users_Set_Input = {
  activeMfaType?: InputMaybe<Scalars['String']>;
  avatarUrl?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  currentChallenge?: InputMaybe<Scalars['String']>;
  defaultRole?: InputMaybe<Scalars['String']>;
  disabled?: InputMaybe<Scalars['Boolean']>;
  displayName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['citext']>;
  emailVerified?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['uuid']>;
  isAnonymous?: InputMaybe<Scalars['Boolean']>;
  lastSeen?: InputMaybe<Scalars['timestamptz']>;
  locale?: InputMaybe<Scalars['String']>;
  metadata?: InputMaybe<Scalars['jsonb']>;
  newEmail?: InputMaybe<Scalars['citext']>;
  otpHash?: InputMaybe<Scalars['String']>;
  otpHashExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: InputMaybe<Scalars['String']>;
  passwordHash?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  phoneNumberVerified?: InputMaybe<Scalars['Boolean']>;
  ticket?: InputMaybe<Scalars['String']>;
  ticketExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  totpSecret?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** Streaming cursor of the table "users" */
export type Users_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_Stream_Cursor_Value_Input = {
  activeMfaType?: InputMaybe<Scalars['String']>;
  avatarUrl?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  currentChallenge?: InputMaybe<Scalars['String']>;
  defaultRole?: InputMaybe<Scalars['String']>;
  disabled?: InputMaybe<Scalars['Boolean']>;
  displayName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['citext']>;
  emailVerified?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['uuid']>;
  isAnonymous?: InputMaybe<Scalars['Boolean']>;
  lastSeen?: InputMaybe<Scalars['timestamptz']>;
  locale?: InputMaybe<Scalars['String']>;
  metadata?: InputMaybe<Scalars['jsonb']>;
  newEmail?: InputMaybe<Scalars['citext']>;
  otpHash?: InputMaybe<Scalars['String']>;
  otpHashExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  otpMethodLastUsed?: InputMaybe<Scalars['String']>;
  passwordHash?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  phoneNumberVerified?: InputMaybe<Scalars['Boolean']>;
  ticket?: InputMaybe<Scalars['String']>;
  ticketExpiresAt?: InputMaybe<Scalars['timestamptz']>;
  totpSecret?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
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

export type Users_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Users_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Users_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Users_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Users_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Users_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Users_Set_Input>;
  where: Users_Bool_Exp;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
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

/** columns and relationships of "workspace_member_invites" */
export type WorkspaceMemberInvites = {
  __typename?: 'workspaceMemberInvites';
  createdAt: Scalars['timestamptz'];
  email: Scalars['citext'];
  id: Scalars['uuid'];
  /** An object relationship */
  invitedByUser: Users;
  invitedByUserId: Scalars['uuid'];
  isAccepted?: Maybe<Scalars['Boolean']>;
  /** owner or member */
  memberType: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  userByEmail?: Maybe<Users>;
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** aggregated selection of "workspace_member_invites" */
export type WorkspaceMemberInvites_Aggregate = {
  __typename?: 'workspaceMemberInvites_aggregate';
  aggregate?: Maybe<WorkspaceMemberInvites_Aggregate_Fields>;
  nodes: Array<WorkspaceMemberInvites>;
};

export type WorkspaceMemberInvites_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp_Count>;
};

export type WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_And = {
  arguments: WorkspaceMemberInvites_Select_Column_WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_Or = {
  arguments: WorkspaceMemberInvites_Select_Column_WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type WorkspaceMemberInvites_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workspace_member_invites" */
export type WorkspaceMemberInvites_Aggregate_Fields = {
  __typename?: 'workspaceMemberInvites_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<WorkspaceMemberInvites_Max_Fields>;
  min?: Maybe<WorkspaceMemberInvites_Min_Fields>;
};


/** aggregate fields of "workspace_member_invites" */
export type WorkspaceMemberInvites_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkspaceMemberInvites_Max_Order_By>;
  min?: InputMaybe<WorkspaceMemberInvites_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workspace_member_invites" */
export type WorkspaceMemberInvites_Arr_Rel_Insert_Input = {
  data: Array<WorkspaceMemberInvites_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workspace_member_invites". All fields are combined with a logical 'AND'. */
export type WorkspaceMemberInvites_Bool_Exp = {
  _and?: InputMaybe<Array<WorkspaceMemberInvites_Bool_Exp>>;
  _not?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  _or?: InputMaybe<Array<WorkspaceMemberInvites_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  email?: InputMaybe<Citext_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  invitedByUser?: InputMaybe<Users_Bool_Exp>;
  invitedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
  isAccepted?: InputMaybe<Boolean_Comparison_Exp>;
  memberType?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userByEmail?: InputMaybe<Users_Bool_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Constraint {
  /** unique or primary key constraint on columns "email", "workspace_id" */
  WorkspaceMemberInvitesEmailWorkspaceIdKey = 'workspace_member_invites_email_workspace_id_key',
  /** unique or primary key constraint on columns "id" */
  WorkspaceMemberInvitesPkey = 'workspace_member_invites_pkey'
}

/** input type for inserting data into table "workspace_member_invites" */
export type WorkspaceMemberInvites_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  email?: InputMaybe<Scalars['citext']>;
  id?: InputMaybe<Scalars['uuid']>;
  invitedByUser?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  invitedByUserId?: InputMaybe<Scalars['uuid']>;
  isAccepted?: InputMaybe<Scalars['Boolean']>;
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userByEmail?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type WorkspaceMemberInvites_Max_Fields = {
  __typename?: 'workspaceMemberInvites_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  email?: Maybe<Scalars['citext']>;
  id?: Maybe<Scalars['uuid']>;
  invitedByUserId?: Maybe<Scalars['uuid']>;
  /** owner or member */
  memberType?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  /** owner or member */
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkspaceMemberInvites_Min_Fields = {
  __typename?: 'workspaceMemberInvites_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  email?: Maybe<Scalars['citext']>;
  id?: Maybe<Scalars['uuid']>;
  invitedByUserId?: Maybe<Scalars['uuid']>;
  /** owner or member */
  memberType?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  /** owner or member */
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspace_member_invites" */
export type WorkspaceMemberInvites_Mutation_Response = {
  __typename?: 'workspaceMemberInvites_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkspaceMemberInvites>;
};

/** on_conflict condition type for table "workspace_member_invites" */
export type WorkspaceMemberInvites_On_Conflict = {
  constraint: WorkspaceMemberInvites_Constraint;
  update_columns?: Array<WorkspaceMemberInvites_Update_Column>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};

/** Ordering options when selecting data from "workspace_member_invites". */
export type WorkspaceMemberInvites_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUser?: InputMaybe<Users_Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  isAccepted?: InputMaybe<Order_By>;
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userByEmail?: InputMaybe<Users_Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workspace_member_invites */
export type WorkspaceMemberInvites_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  InvitedByUserId = 'invitedByUserId',
  /** column name */
  IsAccepted = 'isAccepted',
  /** column name */
  MemberType = 'memberType',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** select "workspaceMemberInvites_aggregate_bool_exp_bool_and_arguments_columns" columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Select_Column_WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  IsAccepted = 'isAccepted'
}

/** select "workspaceMemberInvites_aggregate_bool_exp_bool_or_arguments_columns" columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Select_Column_WorkspaceMemberInvites_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsAccepted = 'isAccepted'
}

/** input type for updating data in table "workspace_member_invites" */
export type WorkspaceMemberInvites_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  email?: InputMaybe<Scalars['citext']>;
  id?: InputMaybe<Scalars['uuid']>;
  invitedByUserId?: InputMaybe<Scalars['uuid']>;
  isAccepted?: InputMaybe<Scalars['Boolean']>;
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "workspaceMemberInvites" */
export type WorkspaceMemberInvites_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkspaceMemberInvites_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkspaceMemberInvites_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  email?: InputMaybe<Scalars['citext']>;
  id?: InputMaybe<Scalars['uuid']>;
  invitedByUserId?: InputMaybe<Scalars['uuid']>;
  isAccepted?: InputMaybe<Scalars['Boolean']>;
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  InvitedByUserId = 'invitedByUserId',
  /** column name */
  IsAccepted = 'isAccepted',
  /** column name */
  MemberType = 'memberType',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkspaceId = 'workspaceId'
}

export type WorkspaceMemberInvites_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  where: WorkspaceMemberInvites_Bool_Exp;
};

/** columns and relationships of "workspace_members" */
export type WorkspaceMembers = {
  __typename?: 'workspaceMembers';
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  /** owner or member */
  type: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** aggregated selection of "workspace_members" */
export type WorkspaceMembers_Aggregate = {
  __typename?: 'workspaceMembers_aggregate';
  aggregate?: Maybe<WorkspaceMembers_Aggregate_Fields>;
  nodes: Array<WorkspaceMembers>;
};

export type WorkspaceMembers_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkspaceMembers_Aggregate_Bool_Exp_Count>;
};

export type WorkspaceMembers_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workspace_members" */
export type WorkspaceMembers_Aggregate_Fields = {
  __typename?: 'workspaceMembers_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<WorkspaceMembers_Max_Fields>;
  min?: Maybe<WorkspaceMembers_Min_Fields>;
};


/** aggregate fields of "workspace_members" */
export type WorkspaceMembers_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "workspace_members" */
export type WorkspaceMembers_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkspaceMembers_Max_Order_By>;
  min?: InputMaybe<WorkspaceMembers_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workspace_members" */
export type WorkspaceMembers_Arr_Rel_Insert_Input = {
  data: Array<WorkspaceMembers_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workspace_members". All fields are combined with a logical 'AND'. */
export type WorkspaceMembers_Bool_Exp = {
  _and?: InputMaybe<Array<WorkspaceMembers_Bool_Exp>>;
  _not?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  _or?: InputMaybe<Array<WorkspaceMembers_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workspace_members" */
export enum WorkspaceMembers_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkspaceMembersPkey = 'workspace_members_pkey',
  /** unique or primary key constraint on columns "workspace_id", "user_id" */
  WorkspaceMembersUserIdWorkspaceIdKey = 'workspace_members_user_id_workspace_id_key'
}

/** input type for inserting data into table "workspace_members" */
export type WorkspaceMembers_Insert_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  user?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  userId?: InputMaybe<Scalars['uuid']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type WorkspaceMembers_Max_Fields = {
  __typename?: 'workspaceMembers_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  /** owner or member */
  type?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by max() on columns of table "workspace_members" */
export type WorkspaceMembers_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** owner or member */
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkspaceMembers_Min_Fields = {
  __typename?: 'workspaceMembers_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']>;
  id?: Maybe<Scalars['uuid']>;
  /** owner or member */
  type?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
  userId?: Maybe<Scalars['uuid']>;
  workspaceId?: Maybe<Scalars['uuid']>;
};

/** order by min() on columns of table "workspace_members" */
export type WorkspaceMembers_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** owner or member */
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspace_members" */
export type WorkspaceMembers_Mutation_Response = {
  __typename?: 'workspaceMembers_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkspaceMembers>;
};

/** on_conflict condition type for table "workspace_members" */
export type WorkspaceMembers_On_Conflict = {
  constraint: WorkspaceMembers_Constraint;
  update_columns?: Array<WorkspaceMembers_Update_Column>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};

/** Ordering options when selecting data from "workspace_members". */
export type WorkspaceMembers_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workspace_members */
export type WorkspaceMembers_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspace_members" */
export enum WorkspaceMembers_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Type = 'type',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** input type for updating data in table "workspace_members" */
export type WorkspaceMembers_Set_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** Streaming cursor of the table "workspaceMembers" */
export type WorkspaceMembers_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkspaceMembers_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkspaceMembers_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "workspace_members" */
export enum WorkspaceMembers_Update_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Type = 'type',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

export type WorkspaceMembers_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  where: WorkspaceMembers_Bool_Exp;
};

/** columns and relationships of "workspaces" */
export type Workspaces = {
  __typename?: 'workspaces';
  /** City, district, suburb, town, or village. */
  addressCity: Scalars['String'];
  /** An object relationship */
  addressCountry?: Maybe<Countries>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: Maybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1: Scalars['String'];
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2: Scalars['String'];
  /** ZIP or postal code. */
  addressPostalCode: Scalars['String'];
  /** State, county, province, or region. */
  addressState: Scalars['String'];
  /** An array relationship */
  apps: Array<Apps>;
  /** An aggregate relationship */
  apps_aggregate: Apps_Aggregate;
  companyName: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  creatorUser?: Maybe<Users>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  email: Scalars['String'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  /** An object relationship */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** An aggregate relationship */
  paymentMethods_aggregate: PaymentMethods_Aggregate;
  slug: Scalars['String'];
  stripeCustomerId?: Maybe<Scalars['String']>;
  taxIdType: Scalars['String'];
  taxIdValue: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** An aggregate relationship */
  workspaceMemberInvites_aggregate: WorkspaceMemberInvites_Aggregate;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** An aggregate relationship */
  workspaceMembers_aggregate: WorkspaceMembers_Aggregate;
};


/** columns and relationships of "workspaces" */
export type WorkspacesAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesApps_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesPaymentMethods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMemberInvites_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMembers_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};

/** aggregated selection of "workspaces" */
export type Workspaces_Aggregate = {
  __typename?: 'workspaces_aggregate';
  aggregate?: Maybe<Workspaces_Aggregate_Fields>;
  nodes: Array<Workspaces>;
};

export type Workspaces_Aggregate_Bool_Exp = {
  count?: InputMaybe<Workspaces_Aggregate_Bool_Exp_Count>;
};

export type Workspaces_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Workspaces_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Workspaces_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workspaces" */
export type Workspaces_Aggregate_Fields = {
  __typename?: 'workspaces_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Workspaces_Max_Fields>;
  min?: Maybe<Workspaces_Min_Fields>;
};


/** aggregate fields of "workspaces" */
export type Workspaces_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Workspaces_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "workspaces" */
export type Workspaces_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Workspaces_Max_Order_By>;
  min?: InputMaybe<Workspaces_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workspaces" */
export type Workspaces_Arr_Rel_Insert_Input = {
  data: Array<Workspaces_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workspaces". All fields are combined with a logical 'AND'. */
export type Workspaces_Bool_Exp = {
  _and?: InputMaybe<Array<Workspaces_Bool_Exp>>;
  _not?: InputMaybe<Workspaces_Bool_Exp>;
  _or?: InputMaybe<Array<Workspaces_Bool_Exp>>;
  addressCity?: InputMaybe<String_Comparison_Exp>;
  addressCountry?: InputMaybe<Countries_Bool_Exp>;
  addressCountryCode?: InputMaybe<String_Comparison_Exp>;
  addressLine1?: InputMaybe<String_Comparison_Exp>;
  addressLine2?: InputMaybe<String_Comparison_Exp>;
  addressPostalCode?: InputMaybe<String_Comparison_Exp>;
  addressState?: InputMaybe<String_Comparison_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Bool_Exp>;
  companyName?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creatorUser?: InputMaybe<Users_Bool_Exp>;
  creatorUserId?: InputMaybe<Uuid_Comparison_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  paymentMethod?: InputMaybe<PaymentMethods_Bool_Exp>;
  paymentMethods?: InputMaybe<PaymentMethods_Bool_Exp>;
  paymentMethods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Bool_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  stripeCustomerId?: InputMaybe<String_Comparison_Exp>;
  taxIdType?: InputMaybe<String_Comparison_Exp>;
  taxIdValue?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workspaceMemberInvites?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  workspaceMemberInvites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Bool_Exp>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "workspaces" */
export enum Workspaces_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkspacesPkey = 'workspaces_pkey',
  /** unique or primary key constraint on columns "slug" */
  WorkspacesSlugKey = 'workspaces_slug_key'
}

/** input type for inserting data into table "workspaces" */
export type Workspaces_Insert_Input = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Scalars['String']>;
  addressCountry?: InputMaybe<Countries_Obj_Rel_Insert_Input>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Scalars['String']>;
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  companyName?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUser?: InputMaybe<Users_Obj_Rel_Insert_Input>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  paymentMethod?: InputMaybe<PaymentMethods_Obj_Rel_Insert_Input>;
  paymentMethods?: InputMaybe<PaymentMethods_Arr_Rel_Insert_Input>;
  slug?: InputMaybe<Scalars['String']>;
  stripeCustomerId?: InputMaybe<Scalars['String']>;
  taxIdType?: InputMaybe<Scalars['String']>;
  taxIdValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  workspaceMemberInvites?: InputMaybe<WorkspaceMemberInvites_Arr_Rel_Insert_Input>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Workspaces_Max_Fields = {
  __typename?: 'workspaces_max_fields';
  /** City, district, suburb, town, or village. */
  addressCity?: Maybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: Maybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: Maybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: Maybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: Maybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: Maybe<Scalars['String']>;
  companyName?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  email?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  stripeCustomerId?: Maybe<Scalars['String']>;
  taxIdType?: Maybe<Scalars['String']>;
  taxIdValue?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "workspaces" */
export type Workspaces_Max_Order_By = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Order_By>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Order_By>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Order_By>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Order_By>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Order_By>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeCustomerId?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Workspaces_Min_Fields = {
  __typename?: 'workspaces_min_fields';
  /** City, district, suburb, town, or village. */
  addressCity?: Maybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: Maybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: Maybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: Maybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: Maybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: Maybe<Scalars['String']>;
  companyName?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  email?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['uuid']>;
  name?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  stripeCustomerId?: Maybe<Scalars['String']>;
  taxIdType?: Maybe<Scalars['String']>;
  taxIdValue?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "workspaces" */
export type Workspaces_Min_Order_By = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Order_By>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Order_By>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Order_By>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Order_By>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Order_By>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeCustomerId?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspaces" */
export type Workspaces_Mutation_Response = {
  __typename?: 'workspaces_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Workspaces>;
};

/** input type for inserting object relation for remote table "workspaces" */
export type Workspaces_Obj_Rel_Insert_Input = {
  data: Workspaces_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};

/** on_conflict condition type for table "workspaces" */
export type Workspaces_On_Conflict = {
  constraint: Workspaces_Constraint;
  update_columns?: Array<Workspaces_Update_Column>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** Ordering options when selecting data from "workspaces". */
export type Workspaces_Order_By = {
  addressCity?: InputMaybe<Order_By>;
  addressCountry?: InputMaybe<Countries_Order_By>;
  addressCountryCode?: InputMaybe<Order_By>;
  addressLine1?: InputMaybe<Order_By>;
  addressLine2?: InputMaybe<Order_By>;
  addressPostalCode?: InputMaybe<Order_By>;
  addressState?: InputMaybe<Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUser?: InputMaybe<Users_Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  paymentMethod?: InputMaybe<PaymentMethods_Order_By>;
  paymentMethods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Order_By>;
  slug?: InputMaybe<Order_By>;
  stripeCustomerId?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceMemberInvites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Order_By>;
};

/** primary key columns input for table: workspaces */
export type Workspaces_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspaces" */
export enum Workspaces_Select_Column {
  /** column name */
  AddressCity = 'addressCity',
  /** column name */
  AddressCountryCode = 'addressCountryCode',
  /** column name */
  AddressLine1 = 'addressLine1',
  /** column name */
  AddressLine2 = 'addressLine2',
  /** column name */
  AddressPostalCode = 'addressPostalCode',
  /** column name */
  AddressState = 'addressState',
  /** column name */
  CompanyName = 'companyName',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Slug = 'slug',
  /** column name */
  StripeCustomerId = 'stripeCustomerId',
  /** column name */
  TaxIdType = 'taxIdType',
  /** column name */
  TaxIdValue = 'taxIdValue',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "workspaces" */
export type Workspaces_Set_Input = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Scalars['String']>;
  companyName?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  stripeCustomerId?: InputMaybe<Scalars['String']>;
  taxIdType?: InputMaybe<Scalars['String']>;
  taxIdValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** Streaming cursor of the table "workspaces" */
export type Workspaces_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Workspaces_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Workspaces_Stream_Cursor_Value_Input = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Scalars['String']>;
  companyName?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  stripeCustomerId?: InputMaybe<Scalars['String']>;
  taxIdType?: InputMaybe<Scalars['String']>;
  taxIdValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** update columns of table "workspaces" */
export enum Workspaces_Update_Column {
  /** column name */
  AddressCity = 'addressCity',
  /** column name */
  AddressCountryCode = 'addressCountryCode',
  /** column name */
  AddressLine1 = 'addressLine1',
  /** column name */
  AddressLine2 = 'addressLine2',
  /** column name */
  AddressPostalCode = 'addressPostalCode',
  /** column name */
  AddressState = 'addressState',
  /** column name */
  CompanyName = 'companyName',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Slug = 'slug',
  /** column name */
  StripeCustomerId = 'stripeCustomerId',
  /** column name */
  TaxIdType = 'taxIdType',
  /** column name */
  TaxIdValue = 'taxIdValue',
  /** column name */
  UpdatedAt = 'updatedAt'
}

export type Workspaces_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Workspaces_Set_Input>;
  where: Workspaces_Bool_Exp;
};

export type DeleteEnvironmentVariableMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteEnvironmentVariableMutation = { __typename?: 'mutation_root', deleteEnvironmentVariable?: { __typename?: 'environmentVariables', id: any } | null };

export type UpdateEnvironmentVariableMutationVariables = Exact<{
  id: Scalars['uuid'];
  environmentVariable: EnvironmentVariables_Set_Input;
}>;


export type UpdateEnvironmentVariableMutation = { __typename?: 'mutation_root', updateEnvironmentVariable?: { __typename?: 'environmentVariables', id: any } | null };

export type GetEnvironmentVariablesQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetEnvironmentVariablesQuery = { __typename?: 'query_root', environmentVariables: Array<{ __typename?: 'environmentVariables', id: any, name: string, updatedAt: any, prodValue: string, devValue: string }> };

export type InsertEnvironmentVariablesMutationVariables = Exact<{
  environmentVariables: Array<EnvironmentVariables_Insert_Input> | EnvironmentVariables_Insert_Input;
}>;


export type InsertEnvironmentVariablesMutation = { __typename?: 'mutation_root', insertEnvironmentVariables?: { __typename?: 'environmentVariables_mutation_response', affected_rows: number } | null };

export type GetAppPlanAndGlobalPlansAppFragment = { __typename?: 'apps', id: any, subdomain: string, workspace: { __typename?: 'workspaces', id: any, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }, plan: { __typename?: 'plans', id: any, name: string } };

export type GetAppPlanAndGlobalPlansPlanFragment = { __typename?: 'plans', id: any, name: string, isFree: boolean, price: number, featureMaxDbSize: number };

export type GetAppPlanAndGlobalPlansQueryVariables = Exact<{
  workspaceSlug: Scalars['String'];
  appSlug: Scalars['String'];
}>;


export type GetAppPlanAndGlobalPlansQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, subdomain: string, workspace: { __typename?: 'workspaces', id: any, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }, plan: { __typename?: 'plans', id: any, name: string } }>, plans: Array<{ __typename?: 'plans', id: any, name: string, isFree: boolean, price: number, featureMaxDbSize: number }> };

export type DeleteApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type DeleteApplicationMutation = { __typename?: 'mutation_root', deleteApp?: { __typename?: 'apps', id: any } | null };

export type GetAllAppsWhereQueryVariables = Exact<{
  where: Apps_Bool_Exp;
}>;


export type GetAllAppsWhereQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string } }> };

export type GetAppFragment = { __typename?: 'apps', id: any, slug: string, subdomain: string, name: string, createdAt: any, authEmailSigninEmailVerifiedRequired: boolean, authPasswordHibpEnabled: boolean, authEmailPasswordlessEnabled: boolean, authSmsPasswordlessEnabled: boolean, authWebAuthnEnabled: boolean, authClientUrl: string, authEmailTemplateFetchUrl?: string | null, authAccessControlAllowedEmails: string, authAccessControlAllowedEmailDomains: string, authAccessControlBlockedEmails: string, authAccessControlBlockedEmailDomains: string, authAccessControlAllowedRedirectUrls: string, authGithubEnabled: boolean, authGithubClientId: string, authGithubClientSecret: string, authGoogleEnabled: boolean, authGoogleClientId: string, authGoogleClientSecret: string, authFacebookEnabled: boolean, authFacebookClientId: string, authFacebookClientSecret: string, authLinkedinEnabled: boolean, authLinkedinClientId: string, authLinkedinClientSecret: string, authTwitterEnabled: boolean, authTwitterConsumerKey: string, authTwitterConsumerSecret: string, authAppleEnabled: boolean, authAppleTeamId: string, authAppleKeyId: string, authAppleClientId: string, authApplePrivateKey: string, authAppleScope: string, authWindowsLiveEnabled: boolean, authWindowsLiveClientId: string, authWindowsLiveClientSecret: string, authSpotifyEnabled: boolean, authSpotifyClientId: string, authSpotifyClientSecret: string, authWorkOsEnabled: boolean, authWorkOsClientId: string, authWorkOsClientSecret: string, authWorkOsDefaultDomain: string, authWorkOsDefaultOrganization: string, authWorkOsDefaultConnection: string };

export type GetAppQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, slug: string, subdomain: string, name: string, createdAt: any, authEmailSigninEmailVerifiedRequired: boolean, authPasswordHibpEnabled: boolean, authEmailPasswordlessEnabled: boolean, authSmsPasswordlessEnabled: boolean, authWebAuthnEnabled: boolean, authClientUrl: string, authEmailTemplateFetchUrl?: string | null, authAccessControlAllowedEmails: string, authAccessControlAllowedEmailDomains: string, authAccessControlBlockedEmails: string, authAccessControlBlockedEmailDomains: string, authAccessControlAllowedRedirectUrls: string, authGithubEnabled: boolean, authGithubClientId: string, authGithubClientSecret: string, authGoogleEnabled: boolean, authGoogleClientId: string, authGoogleClientSecret: string, authFacebookEnabled: boolean, authFacebookClientId: string, authFacebookClientSecret: string, authLinkedinEnabled: boolean, authLinkedinClientId: string, authLinkedinClientSecret: string, authTwitterEnabled: boolean, authTwitterConsumerKey: string, authTwitterConsumerSecret: string, authAppleEnabled: boolean, authAppleTeamId: string, authAppleKeyId: string, authAppleClientId: string, authApplePrivateKey: string, authAppleScope: string, authWindowsLiveEnabled: boolean, authWindowsLiveClientId: string, authWindowsLiveClientSecret: string, authSpotifyEnabled: boolean, authSpotifyClientId: string, authSpotifyClientSecret: string, authWorkOsEnabled: boolean, authWorkOsClientId: string, authWorkOsClientSecret: string, authWorkOsDefaultDomain: string, authWorkOsDefaultOrganization: string, authWorkOsDefaultConnection: string } | null };

export type GetAppByWorkspaceAndNameFragment = { __typename?: 'apps', updatedAt: any, id: any, slug: string, subdomain: string, hasuraGraphqlAdminSecret: string, name: string, createdAt: any, isProvisioned: boolean, providersUpdated?: boolean | null, repositoryProductionBranch: string, githubRepositoryId?: any | null, workspaceId: any, githubRepository?: { __typename?: 'githubRepositories', id: any, name: string, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null } } | null, region: { __typename?: 'regions', countryCode: string, city: string }, workspace: { __typename?: 'workspaces', name: string, slug: string, id: any } };

export type GetAppByWorkspaceAndNameQueryVariables = Exact<{
  workspace: Scalars['String'];
  slug: Scalars['String'];
}>;


export type GetAppByWorkspaceAndNameQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', updatedAt: any, id: any, slug: string, subdomain: string, hasuraGraphqlAdminSecret: string, name: string, createdAt: any, isProvisioned: boolean, providersUpdated?: boolean | null, repositoryProductionBranch: string, githubRepositoryId?: any | null, workspaceId: any, githubRepository?: { __typename?: 'githubRepositories', id: any, name: string, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null } } | null, region: { __typename?: 'regions', countryCode: string, city: string }, workspace: { __typename?: 'workspaces', name: string, slug: string, id: any } }> };

export type GetAppCustomClaimsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppCustomClaimsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, name: string, authJwtCustomClaims: any } | null };

export type GetAppInjectedVariablesQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppInjectedVariablesQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, webhookSecret: string, hasuraGraphqlJwtSecret: string } | null };

export type GetAppRolesFragment = { __typename?: 'apps', id: any, slug: string, subdomain: string, name: string, authUserDefaultAllowedRoles: string, authUserDefaultRole: string };

export type GetAppRolesAndPermissionsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppRolesAndPermissionsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, slug: string, subdomain: string, name: string, authUserDefaultAllowedRoles: string, authUserDefaultRole: string } | null };

export type GetApplicationBackupsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetApplicationBackupsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', backups: Array<{ __typename?: 'backups', id: any, size: any, createdAt: any, completedAt?: any | null }> } | null };

export type GetApplicationPlanQueryVariables = Exact<{
  workspace: Scalars['String'];
  slug: Scalars['String'];
}>;


export type GetApplicationPlanQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, subdomain: string, plan: { __typename?: 'plans', name: string, price: number, upatedAt: any, featureMaxDbSize: number } }> };

export type GetApplicationStateQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetApplicationStateQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, name: string, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }> } | null };

export type GetAppsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAppsQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, slug: string, name: string, subdomain: string }> };

export type GetAppProvisionStatusQueryVariables = Exact<{
  workspace: Scalars['String'];
  slug: Scalars['String'];
}>;


export type GetAppProvisionStatusQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, isProvisioned: boolean, subdomain: string, hasuraGraphqlAdminSecret: string, createdAt: any }> };

export type GetPostgresCredentialsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetPostgresCredentialsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', postgresUser?: string | null, postgresDatabase?: string | null, postgresPassword: string, postgresHost?: string | null } | null };

export type GetRolesQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetRolesQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, authUserDefaultRole: string, authUserDefaultAllowedRoles: string } | null };

export type GetRemoteAppRolesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRemoteAppRolesQuery = { __typename?: 'query_root', authRoles: Array<{ __typename?: 'authRoles', role: string }> };

export type GetSmsSettingsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetSmsSettingsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, authSmsPasswordlessEnabled: boolean, authSmsTwilioAccountSid: string, authSmsTwilioAuthToken: string, authSmsTwilioMessagingServiceId: string, authSmsTwilioFrom: string } | null };

export type GetSmtpSettingsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetSmtpSettingsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, authSmtpSender?: string | null, authSmtpUser?: string | null, authSmtpHost?: string | null, authSmtpPort?: number | null, AuthSmtpSecure?: boolean | null, AuthSmtpAuthMethod?: string | null } | null };

export type InsertApplicationMutationVariables = Exact<{
  app: Apps_Insert_Input;
}>;


export type InsertApplicationMutation = { __typename?: 'mutation_root', insertApp?: { __typename?: 'apps', id: any, name: string, slug: string, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string } } | null };

export type PrefetchNewAppRegionsFragment = { __typename?: 'regions', id: any, city: string, active: boolean, country: { __typename?: 'countries', code: any, name: string } };

export type PrefetchNewAppPlansFragment = { __typename?: 'plans', id: any, name: string, isDefault: boolean, isFree: boolean, price: number, featureBackupEnabled: boolean, featureCustomDomainsEnabled: boolean, featureMaxDbSize: number };

export type PrefetchNewAppWorkspaceFragment = { __typename?: 'workspaces', id: any, name: string, slug: string, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> };

export type PrefetchNewAppQueryVariables = Exact<{ [key: string]: never; }>;


export type PrefetchNewAppQuery = { __typename?: 'query_root', regions: Array<{ __typename?: 'regions', id: any, city: string, active: boolean, country: { __typename?: 'countries', code: any, name: string } }>, plans: Array<{ __typename?: 'plans', id: any, name: string, isDefault: boolean, isFree: boolean, price: number, featureBackupEnabled: boolean, featureCustomDomainsEnabled: boolean, featureMaxDbSize: number }>, workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, slug: string, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }> };

export type UpdateAppMutationVariables = Exact<{
  id: Scalars['uuid'];
  app: Apps_Set_Input;
}>;


export type UpdateAppMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', id: any } | null };

export type UpdateApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
  app: Apps_Set_Input;
}>;


export type UpdateApplicationMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', name: string, id: any, slug: string } | null };

export type GetCountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCountriesQuery = { __typename?: 'query_root', countries: Array<{ __typename?: 'countries', code: any, name: string }> };

export type ResetPostgresPasswordMutationVariables = Exact<{
  appID: Scalars['String'];
  newPassword: Scalars['String'];
}>;


export type ResetPostgresPasswordMutation = { __typename?: 'mutation_root', resetPostgresPassword: boolean };

export type DeploymentRowFragment = { __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null };

export type GetDeploymentsQueryVariables = Exact<{
  id: Scalars['uuid'];
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetDeploymentsQuery = { __typename?: 'query_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type ScheduledOrPendingDeploymentsSubSubscriptionVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type ScheduledOrPendingDeploymentsSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type LatestLiveDeploymentSubSubscriptionVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type LatestLiveDeploymentSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type InsertDeploymentMutationVariables = Exact<{
  object: Deployments_Insert_Input;
}>;


export type InsertDeploymentMutation = { __typename?: 'mutation_root', insertDeployment?: { __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null } | null };

export type GetDeploymentsSubSubscriptionVariables = Exact<{
  id: Scalars['uuid'];
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetDeploymentsSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type DeploymentSubSubscriptionVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeploymentSubSubscription = { __typename?: 'subscription_root', deployment?: { __typename?: 'deployments', id: any, commitMessage?: string | null, commitSHA: string, commitUserName?: string | null, commitUserAvatarUrl?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, metadataStartedAt?: any | null, metadataEndedAt?: any | null, metadataStatus?: string | null, migrationsStartedAt?: any | null, migrationsEndedAt?: any | null, migrationsStatus?: string | null, functionsStartedAt?: any | null, functionsEndedAt?: any | null, functionsStatus?: string | null, deploymentLogs: Array<{ __typename?: 'deploymentLogs', id: any, createdAt: any, message: string }> } | null };

export type InsertFeatureFlagMutationVariables = Exact<{
  flag: FeatureFlags_Insert_Input;
}>;


export type InsertFeatureFlagMutation = { __typename?: 'mutation_root', insertFeatureFlag?: { __typename?: 'featureFlags', id: any } | null };

export type DeleteFilesMutationVariables = Exact<{
  fileIds: Array<Scalars['uuid']> | Scalars['uuid'];
}>;


export type DeleteFilesMutation = { __typename?: 'mutation_root', deleteFiles?: { __typename?: 'files_mutation_response', affected_rows: number } | null };

export type GetBucketsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetBucketsQuery = { __typename?: 'query_root', buckets: Array<{ __typename?: 'buckets', id: string, maxUploadFileSize: number }> };

export type GetFilesQueryVariables = Exact<{
  where?: InputMaybe<Files_Bool_Exp>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Files_Order_By> | Files_Order_By>;
}>;


export type GetFilesQuery = { __typename?: 'query_root', files: Array<{ __typename?: 'files', id: any, bucketId: string, createdAt: any, updatedAt: any, name?: string | null, size?: number | null, mimeType?: string | null, etag?: string | null, isUploaded?: boolean | null, uploadedByUserId?: any | null }> };

export type GetFilesAggregateQueryVariables = Exact<{
  where?: InputMaybe<Files_Bool_Exp>;
}>;


export type GetFilesAggregateQuery = { __typename?: 'query_root', filesAggregate: { __typename?: 'files_aggregate', aggregate?: { __typename?: 'files_aggregate_fields', count: number } | null } };

export type GithubRepositoryFragment = { __typename?: 'githubRepositories', id: any, name: string, fullName: string, private: boolean, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null } };

export type GetGithubRepositoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGithubRepositoriesQuery = { __typename?: 'query_root', githubRepositories: Array<{ __typename?: 'githubRepositories', id: any, name: string, fullName: string, private: boolean, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null } }>, githubAppInstallations: Array<{ __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null }> };

export type GetProjectLogsQueryVariables = Exact<{
  appID: Scalars['String'];
  service?: InputMaybe<Scalars['String']>;
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
}>;


export type GetProjectLogsQuery = { __typename?: 'query_root', logs: Array<{ __typename?: 'Log', log: string, service: string, timestamp: any }> };

export type GetLogsSubscriptionSubscriptionVariables = Exact<{
  appID: Scalars['String'];
  service?: InputMaybe<Scalars['String']>;
  from?: InputMaybe<Scalars['Timestamp']>;
}>;


export type GetLogsSubscriptionSubscription = { __typename?: 'subscription_root', logs: Array<{ __typename?: 'Log', log: string, service: string, timestamp: any }> };

export type ChangePaymentMethodMutationVariables = Exact<{
  workspaceId: Scalars['uuid'];
  paymentMethod: PaymentMethods_Insert_Input;
}>;


export type ChangePaymentMethodMutation = { __typename?: 'mutation_root', deletePaymentMethods?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null, insertPaymentMethod?: { __typename?: 'paymentMethods', id: any } | null };

export type DeletePaymentMethodMutationVariables = Exact<{
  paymentMethodId: Scalars['uuid'];
}>;


export type DeletePaymentMethodMutation = { __typename?: 'mutation_root', deletePaymentMethod?: { __typename?: 'paymentMethods', id: any } | null };

export type GetPaymentMethodsFragment = { __typename?: 'paymentMethods', id: any, createdAt: any, cardBrand: string, cardLast4: string, cardExpMonth: number, cardExpYear: number, isDefault: boolean, workspace: { __typename?: 'workspaces', id: any, apps: Array<{ __typename?: 'apps', id: any, plan: { __typename?: 'plans', isFree: boolean } }> } };

export type GetPaymentMethodsQueryVariables = Exact<{
  workspaceId: Scalars['uuid'];
}>;


export type GetPaymentMethodsQuery = { __typename?: 'query_root', paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, createdAt: any, cardBrand: string, cardLast4: string, cardExpMonth: number, cardExpYear: number, isDefault: boolean, workspace: { __typename?: 'workspaces', id: any, apps: Array<{ __typename?: 'apps', id: any, plan: { __typename?: 'plans', isFree: boolean } }> } }> };

export type InsertNewPaymentMethodMutationVariables = Exact<{
  workspaceId: Scalars['uuid'];
  paymentMethod: PaymentMethods_Insert_Input;
}>;


export type InsertNewPaymentMethodMutation = { __typename?: 'mutation_root', updatePaymentMethods?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null, insertPaymentMethod?: { __typename?: 'paymentMethods', id: any } | null };

export type SetNewDefaultPaymentMethodMutationVariables = Exact<{
  workspaceId: Scalars['uuid'];
  paymentMethodId: Scalars['uuid'];
}>;


export type SetNewDefaultPaymentMethodMutation = { __typename?: 'mutation_root', setAllPaymentMethodToDefaultFalse?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null, updatePaymentMethods?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null };

export type GetPlansQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPlansQuery = { __typename?: 'query_root', plans: Array<{ __typename?: 'plans', id: any, name: string, isFree: boolean, price: number, isDefault: boolean }>, regions: Array<{ __typename?: 'regions', id: any, isGdprCompliant: boolean, city: string, country: { __typename?: 'countries', name: string, continent: { __typename?: 'continents', name?: string | null } } }>, workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, slug: string, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, cardBrand: string, cardLast4: string }> }> };

export type RestoreApplicationDatabaseMutationVariables = Exact<{
  appId: Scalars['String'];
  backupId: Scalars['String'];
}>;


export type RestoreApplicationDatabaseMutation = { __typename?: 'mutation_root', restoreApplicationDatabase: boolean };

export type RemoteAppDeleteUserMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type RemoteAppDeleteUserMutation = { __typename?: 'mutation_root', deleteUser?: { __typename?: 'users', id: any } | null };

export type GetAppFunctionsMetadataQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppFunctionsMetadataQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', metadataFunctions: any } | null };

export type GetAuthSettingsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAuthSettingsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', authAnonymousUsersEnabled: boolean, authDisableNewUsers: boolean, authPasswordMinLength: number, authMfaEnabled: boolean, authMfaTotpIssuer: string, authAccessControlAllowedRedirectUrls: string } | null };

export type GetRemoteAppFilesUsageQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRemoteAppFilesUsageQuery = { __typename?: 'query_root', filesAggregate: { __typename?: 'files_aggregate', aggregate?: { __typename?: 'files_aggregate_fields', count: number, sum?: { __typename?: 'files_sum_fields', size?: number | null } | null } | null } };

export type GetFunctionsLogsQueryVariables = Exact<{
  subdomain: Scalars['String'];
}>;


export type GetFunctionsLogsQuery = { __typename?: 'query_root', getFunctionLogs: Array<{ __typename?: 'FunctionLogEntry', functionPath: string, createdAt: any, message: string }> };

export type GetFunctionLogQueryVariables = Exact<{
  subdomain: Scalars['String'];
  functionPaths?: InputMaybe<Array<Scalars['String']> | Scalars['String']>;
}>;


export type GetFunctionLogQuery = { __typename?: 'query_root', getFunctionLogs: Array<{ __typename?: 'FunctionLogEntry', functionPath: string, createdAt: any, message: string }> };

export type GetGravatarSettingsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetGravatarSettingsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', authGravatarEnabled: boolean, authGravatarDefault: string, authGravatarRating: string } | null };

export type GetRemoteAppMetricsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRemoteAppMetricsQuery = { __typename?: 'query_root', filesAggregate: { __typename?: 'files_aggregate', aggregate?: { __typename?: 'files_aggregate_fields', count: number, sum?: { __typename?: 'files_sum_fields', size?: number | null } | null } | null }, usersAggregate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null } };

export type GetRemoteAppUserFragment = { __typename?: 'users', id: any, createdAt: any, displayName: string, locale: string, avatarUrl: string, email?: any | null, emailVerified: boolean, passwordHash?: string | null, disabled: boolean, phoneNumber?: string | null, phoneNumberVerified: boolean, defaultRole: string, roles: Array<{ __typename?: 'authUserRoles', role: string }>, userProviders: Array<{ __typename?: 'authUserProviders', id: any, provider: { __typename?: 'authProviders', id: string } }> };

export type GetRemoteAppUserAuthRolesFragment = { __typename?: 'authRoles', role: string };

export type GetRemoteAppUserQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetRemoteAppUserQuery = { __typename?: 'query_root', user?: { __typename?: 'users', id: any, createdAt: any, displayName: string, locale: string, avatarUrl: string, email?: any | null, emailVerified: boolean, passwordHash?: string | null, disabled: boolean, phoneNumber?: string | null, phoneNumberVerified: boolean, defaultRole: string, roles: Array<{ __typename?: 'authUserRoles', role: string }>, userProviders: Array<{ __typename?: 'authUserProviders', id: any, provider: { __typename?: 'authProviders', id: string } }> } | null, authRoles: Array<{ __typename?: 'authRoles', role: string }> };

export type GetRemoteAppUserWhereQueryVariables = Exact<{
  where: Users_Bool_Exp;
}>;


export type GetRemoteAppUserWhereQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: any, displayName: string, email?: any | null, defaultRole: string }> };

export type GetRemoteAppByIdQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetRemoteAppByIdQuery = { __typename?: 'query_root', user?: { __typename?: 'users', id: any, displayName: string, email?: any | null } | null };

export type RemoteAppGetUsersFragment = { __typename?: 'users', id: any, createdAt: any, displayName: string, avatarUrl: string, email?: any | null, emailVerified: boolean, phoneNumber?: string | null, phoneNumberVerified: boolean, disabled: boolean, defaultRole: string, lastSeen?: any | null, locale: string, roles: Array<{ __typename?: 'authUserRoles', id: any, role: string }>, userProviders: Array<{ __typename?: 'authUserProviders', id: any, providerId: string }> };

export type RemoteAppGetUsersQueryVariables = Exact<{
  where: Users_Bool_Exp;
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type RemoteAppGetUsersQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: any, createdAt: any, displayName: string, avatarUrl: string, email?: any | null, emailVerified: boolean, phoneNumber?: string | null, phoneNumberVerified: boolean, disabled: boolean, defaultRole: string, lastSeen?: any | null, locale: string, roles: Array<{ __typename?: 'authUserRoles', id: any, role: string }>, userProviders: Array<{ __typename?: 'authUserProviders', id: any, providerId: string }> }>, filteredUsersAggreggate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null }, usersAggregate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null } };

export type RemoteAppGetUsersCustomQueryVariables = Exact<{
  where: Users_Bool_Exp;
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type RemoteAppGetUsersCustomQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: any, createdAt: any, displayName: string, phoneNumber?: string | null, avatarUrl: string, email?: any | null, disabled: boolean, defaultRole: string, isAnonymous: boolean, roles: Array<{ __typename?: 'authUserRoles', role: string }> }> };

export type RemoteAppGetUsersWholeQueryVariables = Exact<{
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type RemoteAppGetUsersWholeQuery = { __typename?: 'query_root', users: Array<{ __typename?: 'users', id: any, createdAt: any, displayName: string, avatarUrl: string, email?: any | null, emailVerified: boolean, phoneNumber?: string | null, phoneNumberVerified: boolean, disabled: boolean, defaultRole: string, lastSeen?: any | null, locale: string, roles: Array<{ __typename?: 'authUserRoles', id: any, role: string }>, userProviders: Array<{ __typename?: 'authUserProviders', id: any, providerId: string }> }>, usersAggregate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null } };

export type TotalUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type TotalUsersQuery = { __typename?: 'query_root', usersAggregate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null } };

export type TotalUsersByDateQueryVariables = Exact<{
  where: Users_Bool_Exp;
}>;


export type TotalUsersByDateQuery = { __typename?: 'query_root', usersAggregate: { __typename?: 'users_aggregate', aggregate?: { __typename?: 'users_aggregate_fields', count: number } | null } };

export type RestoreDatabaseBackupMutationVariables = Exact<{
  appId: Scalars['uuid'];
  backupId: Scalars['uuid'];
}>;


export type RestoreDatabaseBackupMutation = { __typename?: 'mutation_root', restoreDatabaseBackup: boolean };

export type ScheduleRestoreDatabaseBackupMutationVariables = Exact<{
  appId: Scalars['uuid'];
  backupId: Scalars['uuid'];
}>;


export type ScheduleRestoreDatabaseBackupMutation = { __typename?: 'mutation_root', scheduleRestoreDatabaseBackup: string };

export type UpdateRemoteAppUserMutationVariables = Exact<{
  id: Scalars['uuid'];
  user: Users_Set_Input;
}>;


export type UpdateRemoteAppUserMutation = { __typename?: 'mutation_root', updateUser?: { __typename?: 'users', id: any } | null };

export type InsertRemoteAppUserRolesMutationVariables = Exact<{
  roles: Array<AuthUserRoles_Insert_Input> | AuthUserRoles_Insert_Input;
}>;


export type InsertRemoteAppUserRolesMutation = { __typename?: 'mutation_root', insertAuthUserRoles?: { __typename?: 'authUserRoles_mutation_response', affected_rows: number } | null };

export type DeleteRemoteAppUserRolesMutationVariables = Exact<{
  userId: Scalars['uuid'];
  roles: Array<Scalars['String']> | Scalars['String'];
}>;


export type DeleteRemoteAppUserRolesMutation = { __typename?: 'mutation_root', deleteAuthUserRoles?: { __typename?: 'authUserRoles_mutation_response', affected_rows: number } | null };

export type ConfirmProvidersUpdatedMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type ConfirmProvidersUpdatedMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', id: any } | null };

export type GetDatabaseConnectionInfoQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetDatabaseConnectionInfoQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, postgresUser?: string | null, postgresDatabase?: string | null } | null };

export type SignInMethodsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type SignInMethodsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, slug: string, subdomain: string, authEmailPasswordlessEnabled: boolean, authEmailSigninEmailVerifiedRequired: boolean, authAnonymousUsersEnabled: boolean, authWebAuthnEnabled: boolean, authSmsPasswordlessEnabled: boolean, authSmsTwilioAccountSid: string, authSmsTwilioAuthToken: string, authSmsTwilioMessagingServiceId: string, authSmsTwilioFrom: string, authPasswordHibpEnabled: boolean, authGithubEnabled: boolean, authGithubClientId: string, authGithubClientSecret: string, authGoogleEnabled: boolean, authGoogleClientId: string, authGoogleClientSecret: string, authFacebookEnabled: boolean, authFacebookClientId: string, authFacebookClientSecret: string, authLinkedinEnabled: boolean, authLinkedinClientId: string, authLinkedinClientSecret: string, authDiscordEnabled: boolean, authDiscordClientId: string, authDiscordClientSecret: string, authTwitchEnabled: boolean, authTwitchClientId: string, authTwitchClientSecret: string, authTwitterEnabled: boolean, authTwitterConsumerKey: string, authTwitterConsumerSecret: string, authAppleEnabled: boolean, authAppleTeamId: string, authAppleKeyId: string, authAppleClientId: string, authApplePrivateKey: string, authAppleScope: string, authWindowsLiveEnabled: boolean, authWindowsLiveClientId: string, authWindowsLiveClientSecret: string, authSpotifyEnabled: boolean, authSpotifyClientId: string, authSpotifyClientSecret: string, authWorkOsEnabled: boolean, authWorkOsClientId: string, authWorkOsClientSecret: string, authWorkOsDefaultDomain: string, authWorkOsDefaultOrganization: string, authWorkOsDefaultConnection: string } | null };

export type GetAllUserDataQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllUserDataQuery = { __typename?: 'query_root', workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, workspace: { __typename?: 'workspaces', id: any, name: string, creatorUserId?: any | null, apps: Array<{ __typename?: 'apps', id: any, name: string, hasuraGraphqlAdminSecret: string, subdomain: string }> } }> };

export type GetAvatarQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type GetAvatarQuery = { __typename?: 'query_root', user?: { __typename?: 'users', id: any, avatarUrl: string } | null };

export type GetOneUserQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type GetOneUserQuery = { __typename?: 'query_root', user?: { __typename?: 'users', id: any, displayName: string, avatarUrl: string, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, userId: any, workspaceId: any, type: string, workspace: { __typename?: 'workspaces', creatorUserId?: any | null, id: any, slug: string, name: string, apps: Array<{ __typename?: 'apps', id: any, slug: string, name: string, hasuraGraphqlAdminSecret: string, repositoryProductionBranch: string, subdomain: string, isProvisioned: boolean, createdAt: any, desiredState: number, nhostBaseFolder: string, providersUpdated?: boolean | null, featureFlags: Array<{ __typename?: 'featureFlags', description: string, id: any, name: string, value: string }>, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }>, region: { __typename?: 'regions', id: any, countryCode: string, awsName: string, city: string }, plan: { __typename?: 'plans', id: any, name: string, isFree: boolean }, githubRepository?: { __typename?: 'githubRepositories', fullName: string } | null, deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, commitMessage?: string | null, commitUserName?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, commitUserAvatarUrl?: string | null, deploymentStatus?: string | null }> }> } }> } | null };

export type GetUserAllWorkspacesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserAllWorkspacesQuery = { __typename?: 'query_root', workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, userId: any, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string, apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, plan: { __typename?: 'plans', id: any, name: string } }> } }> };

export type InsertFeedbackOneMutationVariables = Exact<{
  feedback: Feedback_Insert_Input;
}>;


export type InsertFeedbackOneMutation = { __typename?: 'mutation_root', insertFeedbackOne?: { __typename?: 'feedback', id: number } | null };

export type DeleteWorkspaceMemberInvitesMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMemberInvitesMutation = { __typename?: 'mutation_root', deleteWorkspaceMemberInvites?: { __typename?: 'workspaceMemberInvites_mutation_response', affected_rows: number } | null };

export type GetWorkspaceMemberInvitesToManageQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type GetWorkspaceMemberInvitesToManageQuery = { __typename?: 'query_root', workspaceMemberInvites: Array<{ __typename?: 'workspaceMemberInvites', id: any, email: any, userByEmail?: { __typename?: 'users', id: any } | null, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string } }> };

export type InsertWorkspaceMemberInviteMutationVariables = Exact<{
  workspaceMemberInvite: WorkspaceMemberInvites_Insert_Input;
}>;


export type InsertWorkspaceMemberInviteMutation = { __typename?: 'mutation_root', insertWorkspaceMemberInvite?: { __typename?: 'workspaceMemberInvites', id: any } | null };

export type UpdateWorkspaceMemberInviteMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspaceMemberInvite: WorkspaceMemberInvites_Set_Input;
}>;


export type UpdateWorkspaceMemberInviteMutation = { __typename?: 'mutation_root', updateWorkspaceMemberInvites?: { __typename?: 'workspaceMemberInvites_mutation_response', affected_rows: number } | null };

export type DeleteWorkspaceMemberMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMemberMutation = { __typename?: 'mutation_root', deleteWorkspaceMember?: { __typename?: 'workspaceMembers', id: any } | null };

export type GetWorkspaceMembersWorkspaceMemberFragment = { __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, displayName: string, avatarUrl: string, email?: any | null } };

export type GetWorkspaceMembersWorkspaceMemberInviteFragment = { __typename?: 'workspaceMemberInvites', id: any, email: any, memberType: string };

export type GetWorkspaceMembersQueryVariables = Exact<{
  workspaceId: Scalars['uuid'];
}>;


export type GetWorkspaceMembersQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, creatorUser?: { __typename?: 'users', id: any } | null, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, displayName: string, avatarUrl: string, email?: any | null } }>, workspaceMemberInvites: Array<{ __typename?: 'workspaceMemberInvites', id: any, email: any, memberType: string }> } | null };

export type UpdateWorkspaceMemberMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspaceMember: WorkspaceMembers_Set_Input;
}>;


export type UpdateWorkspaceMemberMutation = { __typename?: 'mutation_root', updateWorkspaceMember?: { __typename?: 'workspaceMembers', id: any } | null };

export type DeleteWorkspaceMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMutation = { __typename?: 'mutation_root', deleteWorkspace?: { __typename?: 'workspaces', id: any } | null };

export type GetAppsByWorkspaceQueryVariables = Exact<{
  workspace_id: Scalars['uuid'];
}>;


export type GetAppsByWorkspaceQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, name: string, slug: string, apps: Array<{ __typename?: 'apps', name: string, plan: { __typename?: 'plans', id: any, name: string } }> } | null };

export type GetWorkspaceInvoicesQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetWorkspaceInvoicesQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any } | null };

export type GetWorkspaceSettingsQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetWorkspaceSettingsQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, name: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressState: string, addressCountryCode?: string | null, companyName: string, email: string } | null };

export type GetWorkspaceFragment = { __typename?: 'workspaces', id: any, name: string, email: string, companyName: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressCountryCode?: string | null, slug: string, taxIdType: string, taxIdValue: string, apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, createdAt: any, workspace: { __typename?: 'workspaces', id: any, slug: string } }>, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, cardBrand: string, cardLast4: string, stripePaymentMethodId: string }>, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any } }> };

export type GetWorkspaceQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetWorkspaceQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, name: string, email: string, companyName: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressCountryCode?: string | null, slug: string, taxIdType: string, taxIdValue: string, apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, createdAt: any, workspace: { __typename?: 'workspaces', id: any, slug: string } }>, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, cardBrand: string, cardLast4: string, stripePaymentMethodId: string }>, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any } }> } | null };

export type GetWorkspaceWhereQueryVariables = Exact<{
  where: Workspaces_Bool_Exp;
}>;


export type GetWorkspaceWhereQuery = { __typename?: 'query_root', workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, email: string, companyName: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressCountryCode?: string | null, slug: string, taxIdType: string, taxIdValue: string, apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, createdAt: any, workspace: { __typename?: 'workspaces', id: any, slug: string } }>, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, cardBrand: string, cardLast4: string, stripePaymentMethodId: string }>, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any } }> }> };

export type GetWorkspacesAppsByIdQueryVariables = Exact<{
  workspaceId: Scalars['uuid'];
}>;


export type GetWorkspacesAppsByIdQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, slug: string, apps: Array<{ __typename?: 'apps', id: any, name: string, slug: string, updatedAt: any, plan: { __typename?: 'plans', id: any, name: string } }> } | null };

export type InsertWorkspaceMutationVariables = Exact<{
  workspace: Workspaces_Insert_Input;
}>;


export type InsertWorkspaceMutation = { __typename?: 'mutation_root', insertWorkspace?: { __typename?: 'workspaces', name: string, id: any } | null };

export type UpdateWorkspaceMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspace: Workspaces_Set_Input;
}>;


export type UpdateWorkspaceMutation = { __typename?: 'mutation_root', updateWorkspace?: { __typename?: 'workspaces', id: any, name: string, email: string, companyName: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressCountryCode?: string | null, slug: string, taxIdType: string, taxIdValue: string } | null };

export type GetWorkspacesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetWorkspacesQuery = { __typename?: 'query_root', workspaces: Array<{ __typename?: 'workspaces', id: any, createdAt: any, name: string, slug: string, creatorUserId?: any | null }> };

export const GetAppPlanAndGlobalPlansAppFragmentDoc = gql`
    fragment getAppPlanAndGlobalPlansApp on apps {
  id
  subdomain
  workspace {
    id
    paymentMethods {
      id
    }
  }
  plan {
    id
    name
  }
}
    `;
export const GetAppPlanAndGlobalPlansPlanFragmentDoc = gql`
    fragment getAppPlanAndGlobalPlansPlan on plans {
  id
  name
  isFree
  price
  featureMaxDbSize
}
    `;
export const GetAppFragmentDoc = gql`
    fragment GetApp on apps {
  id
  slug
  subdomain
  name
  createdAt
  authEmailSigninEmailVerifiedRequired
  authPasswordHibpEnabled
  authEmailPasswordlessEnabled
  authSmsPasswordlessEnabled
  authWebAuthnEnabled
  authClientUrl
  authEmailTemplateFetchUrl
  authAccessControlAllowedEmails
  authAccessControlAllowedEmailDomains
  authAccessControlBlockedEmails
  authAccessControlBlockedEmailDomains
  authAccessControlAllowedRedirectUrls
  authGithubEnabled
  authGithubClientId
  authGithubClientSecret
  authGoogleEnabled
  authGoogleClientId
  authGoogleClientSecret
  authFacebookEnabled
  authFacebookClientId
  authFacebookClientSecret
  authLinkedinEnabled
  authLinkedinClientId
  authLinkedinClientSecret
  authTwitterEnabled
  authTwitterConsumerKey
  authTwitterConsumerSecret
  authAppleEnabled
  authAppleTeamId
  authAppleKeyId
  authAppleClientId
  authApplePrivateKey
  authAppleScope
  authWindowsLiveEnabled
  authWindowsLiveClientId
  authWindowsLiveClientSecret
  authSpotifyEnabled
  authSpotifyClientId
  authSpotifyClientSecret
  authWorkOsEnabled
  authWorkOsClientId
  authWorkOsClientSecret
  authWorkOsDefaultDomain
  authWorkOsDefaultOrganization
  authWorkOsDefaultConnection
}
    `;
export const GetAppByWorkspaceAndNameFragmentDoc = gql`
    fragment GetAppByWorkspaceAndName on apps {
  updatedAt
  id
  slug
  subdomain
  hasuraGraphqlAdminSecret
  name
  createdAt
  isProvisioned
  providersUpdated
  githubRepository {
    id
    name
    githubAppInstallation {
      id
      accountLogin
    }
  }
  repositoryProductionBranch
  githubRepositoryId
  region {
    countryCode
    city
  }
  workspace {
    name
    slug
    id
  }
  workspaceId
}
    `;
export const GetAppRolesFragmentDoc = gql`
    fragment GetAppRoles on apps {
  id
  slug
  subdomain
  name
  authUserDefaultAllowedRoles
  authUserDefaultRole
}
    `;
export const PrefetchNewAppRegionsFragmentDoc = gql`
    fragment PrefetchNewAppRegions on regions {
  id
  city
  active
  country {
    code
    name
  }
}
    `;
export const PrefetchNewAppPlansFragmentDoc = gql`
    fragment PrefetchNewAppPlans on plans {
  id
  name
  isDefault
  isFree
  price
  featureBackupEnabled
  featureCustomDomainsEnabled
  featureMaxDbSize
}
    `;
export const PrefetchNewAppWorkspaceFragmentDoc = gql`
    fragment PrefetchNewAppWorkspace on workspaces {
  id
  name
  slug
  paymentMethods {
    id
  }
}
    `;
export const DeploymentRowFragmentDoc = gql`
    fragment DeploymentRow on deployments {
  id
  commitSHA
  deploymentStartedAt
  deploymentEndedAt
  deploymentStatus
  commitUserName
  commitUserAvatarUrl
  commitMessage
}
    `;
export const GithubRepositoryFragmentDoc = gql`
    fragment GithubRepository on githubRepositories {
  id
  name
  fullName
  private
  githubAppInstallation {
    id
    accountLogin
    accountType
    accountAvatarUrl
  }
}
    `;
export const GetPaymentMethodsFragmentDoc = gql`
    fragment getPaymentMethods on paymentMethods {
  id
  createdAt
  cardBrand
  cardLast4
  cardExpMonth
  cardExpYear
  isDefault
  workspace {
    id
    apps {
      id
      plan {
        isFree
      }
    }
  }
}
    `;
export const GetRemoteAppUserFragmentDoc = gql`
    fragment GetRemoteAppUser on users {
  id
  createdAt
  displayName
  locale
  avatarUrl
  email
  emailVerified
  passwordHash
  locale
  disabled
  phoneNumber
  phoneNumberVerified
  defaultRole
  roles {
    role
  }
  userProviders {
    id
    provider {
      id
    }
  }
}
    `;
export const GetRemoteAppUserAuthRolesFragmentDoc = gql`
    fragment GetRemoteAppUserAuthRoles on authRoles {
  role
}
    `;
export const RemoteAppGetUsersFragmentDoc = gql`
    fragment RemoteAppGetUsers on users {
  id
  createdAt
  displayName
  avatarUrl
  email
  emailVerified
  phoneNumber
  phoneNumberVerified
  disabled
  defaultRole
  lastSeen
  locale
  roles {
    id
    role
  }
  userProviders {
    id
    providerId
  }
  disabled
}
    `;
export const GetWorkspaceMembersWorkspaceMemberFragmentDoc = gql`
    fragment getWorkspaceMembersWorkspaceMember on workspaceMembers {
  id
  type
  user {
    id
    displayName
    avatarUrl
    email
  }
}
    `;
export const GetWorkspaceMembersWorkspaceMemberInviteFragmentDoc = gql`
    fragment getWorkspaceMembersWorkspaceMemberInvite on workspaceMemberInvites {
  id
  email
  memberType
}
    `;
export const GetWorkspaceFragmentDoc = gql`
    fragment GetWorkspace on workspaces {
  id
  name
  email
  companyName
  addressLine1
  addressLine2
  addressPostalCode
  addressCity
  addressCountryCode
  slug
  taxIdType
  taxIdValue
  apps {
    id
    name
    slug
    createdAt
    workspace {
      id
      slug
    }
  }
  paymentMethods {
    id
    cardBrand
    cardLast4
    stripePaymentMethodId
  }
  workspaceMembers {
    id
    user {
      id
    }
    type
  }
}
    `;
export const DeleteEnvironmentVariableDocument = gql`
    mutation deleteEnvironmentVariable($id: uuid!) {
  deleteEnvironmentVariable(id: $id) {
    id
  }
}
    `;
export type DeleteEnvironmentVariableMutationFn = Apollo.MutationFunction<DeleteEnvironmentVariableMutation, DeleteEnvironmentVariableMutationVariables>;

/**
 * __useDeleteEnvironmentVariableMutation__
 *
 * To run a mutation, you first call `useDeleteEnvironmentVariableMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteEnvironmentVariableMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteEnvironmentVariableMutation, { data, loading, error }] = useDeleteEnvironmentVariableMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteEnvironmentVariableMutation(baseOptions?: Apollo.MutationHookOptions<DeleteEnvironmentVariableMutation, DeleteEnvironmentVariableMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteEnvironmentVariableMutation, DeleteEnvironmentVariableMutationVariables>(DeleteEnvironmentVariableDocument, options);
      }
export type DeleteEnvironmentVariableMutationHookResult = ReturnType<typeof useDeleteEnvironmentVariableMutation>;
export type DeleteEnvironmentVariableMutationResult = Apollo.MutationResult<DeleteEnvironmentVariableMutation>;
export type DeleteEnvironmentVariableMutationOptions = Apollo.BaseMutationOptions<DeleteEnvironmentVariableMutation, DeleteEnvironmentVariableMutationVariables>;
export const UpdateEnvironmentVariableDocument = gql`
    mutation updateEnvironmentVariable($id: uuid!, $environmentVariable: environmentVariables_set_input!) {
  updateEnvironmentVariable(pk_columns: {id: $id}, _set: $environmentVariable) {
    id
  }
}
    `;
export type UpdateEnvironmentVariableMutationFn = Apollo.MutationFunction<UpdateEnvironmentVariableMutation, UpdateEnvironmentVariableMutationVariables>;

/**
 * __useUpdateEnvironmentVariableMutation__
 *
 * To run a mutation, you first call `useUpdateEnvironmentVariableMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateEnvironmentVariableMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateEnvironmentVariableMutation, { data, loading, error }] = useUpdateEnvironmentVariableMutation({
 *   variables: {
 *      id: // value for 'id'
 *      environmentVariable: // value for 'environmentVariable'
 *   },
 * });
 */
export function useUpdateEnvironmentVariableMutation(baseOptions?: Apollo.MutationHookOptions<UpdateEnvironmentVariableMutation, UpdateEnvironmentVariableMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateEnvironmentVariableMutation, UpdateEnvironmentVariableMutationVariables>(UpdateEnvironmentVariableDocument, options);
      }
export type UpdateEnvironmentVariableMutationHookResult = ReturnType<typeof useUpdateEnvironmentVariableMutation>;
export type UpdateEnvironmentVariableMutationResult = Apollo.MutationResult<UpdateEnvironmentVariableMutation>;
export type UpdateEnvironmentVariableMutationOptions = Apollo.BaseMutationOptions<UpdateEnvironmentVariableMutation, UpdateEnvironmentVariableMutationVariables>;
export const GetEnvironmentVariablesDocument = gql`
    query getEnvironmentVariables($id: uuid!) {
  environmentVariables(where: {appId: {_eq: $id}}) {
    id
    name
    updatedAt
    prodValue
    devValue
  }
}
    `;

/**
 * __useGetEnvironmentVariablesQuery__
 *
 * To run a query within a React component, call `useGetEnvironmentVariablesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetEnvironmentVariablesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetEnvironmentVariablesQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetEnvironmentVariablesQuery(baseOptions: Apollo.QueryHookOptions<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>(GetEnvironmentVariablesDocument, options);
      }
export function useGetEnvironmentVariablesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>(GetEnvironmentVariablesDocument, options);
        }
export type GetEnvironmentVariablesQueryHookResult = ReturnType<typeof useGetEnvironmentVariablesQuery>;
export type GetEnvironmentVariablesLazyQueryHookResult = ReturnType<typeof useGetEnvironmentVariablesLazyQuery>;
export type GetEnvironmentVariablesQueryResult = Apollo.QueryResult<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>;
export function refetchGetEnvironmentVariablesQuery(variables: GetEnvironmentVariablesQueryVariables) {
      return { query: GetEnvironmentVariablesDocument, variables: variables }
    }
export const InsertEnvironmentVariablesDocument = gql`
    mutation insertEnvironmentVariables($environmentVariables: [environmentVariables_insert_input!]!) {
  insertEnvironmentVariables(objects: $environmentVariables) {
    affected_rows
  }
}
    `;
export type InsertEnvironmentVariablesMutationFn = Apollo.MutationFunction<InsertEnvironmentVariablesMutation, InsertEnvironmentVariablesMutationVariables>;

/**
 * __useInsertEnvironmentVariablesMutation__
 *
 * To run a mutation, you first call `useInsertEnvironmentVariablesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertEnvironmentVariablesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertEnvironmentVariablesMutation, { data, loading, error }] = useInsertEnvironmentVariablesMutation({
 *   variables: {
 *      environmentVariables: // value for 'environmentVariables'
 *   },
 * });
 */
export function useInsertEnvironmentVariablesMutation(baseOptions?: Apollo.MutationHookOptions<InsertEnvironmentVariablesMutation, InsertEnvironmentVariablesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertEnvironmentVariablesMutation, InsertEnvironmentVariablesMutationVariables>(InsertEnvironmentVariablesDocument, options);
      }
export type InsertEnvironmentVariablesMutationHookResult = ReturnType<typeof useInsertEnvironmentVariablesMutation>;
export type InsertEnvironmentVariablesMutationResult = Apollo.MutationResult<InsertEnvironmentVariablesMutation>;
export type InsertEnvironmentVariablesMutationOptions = Apollo.BaseMutationOptions<InsertEnvironmentVariablesMutation, InsertEnvironmentVariablesMutationVariables>;
export const GetAppPlanAndGlobalPlansDocument = gql`
    query getAppPlanAndGlobalPlans($workspaceSlug: String!, $appSlug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspaceSlug}}, slug: {_eq: $appSlug}}) {
    ...getAppPlanAndGlobalPlansApp
  }
  plans {
    ...getAppPlanAndGlobalPlansPlan
  }
}
    ${GetAppPlanAndGlobalPlansAppFragmentDoc}
${GetAppPlanAndGlobalPlansPlanFragmentDoc}`;

/**
 * __useGetAppPlanAndGlobalPlansQuery__
 *
 * To run a query within a React component, call `useGetAppPlanAndGlobalPlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppPlanAndGlobalPlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppPlanAndGlobalPlansQuery({
 *   variables: {
 *      workspaceSlug: // value for 'workspaceSlug'
 *      appSlug: // value for 'appSlug'
 *   },
 * });
 */
export function useGetAppPlanAndGlobalPlansQuery(baseOptions: Apollo.QueryHookOptions<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>(GetAppPlanAndGlobalPlansDocument, options);
      }
export function useGetAppPlanAndGlobalPlansLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>(GetAppPlanAndGlobalPlansDocument, options);
        }
export type GetAppPlanAndGlobalPlansQueryHookResult = ReturnType<typeof useGetAppPlanAndGlobalPlansQuery>;
export type GetAppPlanAndGlobalPlansLazyQueryHookResult = ReturnType<typeof useGetAppPlanAndGlobalPlansLazyQuery>;
export type GetAppPlanAndGlobalPlansQueryResult = Apollo.QueryResult<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>;
export function refetchGetAppPlanAndGlobalPlansQuery(variables: GetAppPlanAndGlobalPlansQueryVariables) {
      return { query: GetAppPlanAndGlobalPlansDocument, variables: variables }
    }
export const DeleteApplicationDocument = gql`
    mutation deleteApplication($appId: uuid!) {
  deleteApp(id: $appId) {
    id
  }
}
    `;
export type DeleteApplicationMutationFn = Apollo.MutationFunction<DeleteApplicationMutation, DeleteApplicationMutationVariables>;

/**
 * __useDeleteApplicationMutation__
 *
 * To run a mutation, you first call `useDeleteApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteApplicationMutation, { data, loading, error }] = useDeleteApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useDeleteApplicationMutation(baseOptions?: Apollo.MutationHookOptions<DeleteApplicationMutation, DeleteApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteApplicationMutation, DeleteApplicationMutationVariables>(DeleteApplicationDocument, options);
      }
export type DeleteApplicationMutationHookResult = ReturnType<typeof useDeleteApplicationMutation>;
export type DeleteApplicationMutationResult = Apollo.MutationResult<DeleteApplicationMutation>;
export type DeleteApplicationMutationOptions = Apollo.BaseMutationOptions<DeleteApplicationMutation, DeleteApplicationMutationVariables>;
export const GetAllAppsWhereDocument = gql`
    query getAllAppsWhere($where: apps_bool_exp!) {
  apps(where: $where) {
    id
    name
    slug
    workspace {
      id
      name
      slug
    }
  }
}
    `;

/**
 * __useGetAllAppsWhereQuery__
 *
 * To run a query within a React component, call `useGetAllAppsWhereQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllAppsWhereQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllAppsWhereQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetAllAppsWhereQuery(baseOptions: Apollo.QueryHookOptions<GetAllAppsWhereQuery, GetAllAppsWhereQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllAppsWhereQuery, GetAllAppsWhereQueryVariables>(GetAllAppsWhereDocument, options);
      }
export function useGetAllAppsWhereLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllAppsWhereQuery, GetAllAppsWhereQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllAppsWhereQuery, GetAllAppsWhereQueryVariables>(GetAllAppsWhereDocument, options);
        }
export type GetAllAppsWhereQueryHookResult = ReturnType<typeof useGetAllAppsWhereQuery>;
export type GetAllAppsWhereLazyQueryHookResult = ReturnType<typeof useGetAllAppsWhereLazyQuery>;
export type GetAllAppsWhereQueryResult = Apollo.QueryResult<GetAllAppsWhereQuery, GetAllAppsWhereQueryVariables>;
export function refetchGetAllAppsWhereQuery(variables: GetAllAppsWhereQueryVariables) {
      return { query: GetAllAppsWhereDocument, variables: variables }
    }
export const GetAppDocument = gql`
    query getApp($id: uuid!) {
  app(id: $id) {
    ...GetApp
  }
}
    ${GetAppFragmentDoc}`;

/**
 * __useGetAppQuery__
 *
 * To run a query within a React component, call `useGetAppQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppQuery(baseOptions: Apollo.QueryHookOptions<GetAppQuery, GetAppQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppQuery, GetAppQueryVariables>(GetAppDocument, options);
      }
export function useGetAppLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppQuery, GetAppQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppQuery, GetAppQueryVariables>(GetAppDocument, options);
        }
export type GetAppQueryHookResult = ReturnType<typeof useGetAppQuery>;
export type GetAppLazyQueryHookResult = ReturnType<typeof useGetAppLazyQuery>;
export type GetAppQueryResult = Apollo.QueryResult<GetAppQuery, GetAppQueryVariables>;
export function refetchGetAppQuery(variables: GetAppQueryVariables) {
      return { query: GetAppDocument, variables: variables }
    }
export const GetAppByWorkspaceAndNameDocument = gql`
    query getAppByWorkspaceAndName($workspace: String!, $slug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspace}}, slug: {_eq: $slug}}) {
    ...GetAppByWorkspaceAndName
  }
}
    ${GetAppByWorkspaceAndNameFragmentDoc}`;

/**
 * __useGetAppByWorkspaceAndNameQuery__
 *
 * To run a query within a React component, call `useGetAppByWorkspaceAndNameQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppByWorkspaceAndNameQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppByWorkspaceAndNameQuery({
 *   variables: {
 *      workspace: // value for 'workspace'
 *      slug: // value for 'slug'
 *   },
 * });
 */
export function useGetAppByWorkspaceAndNameQuery(baseOptions: Apollo.QueryHookOptions<GetAppByWorkspaceAndNameQuery, GetAppByWorkspaceAndNameQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppByWorkspaceAndNameQuery, GetAppByWorkspaceAndNameQueryVariables>(GetAppByWorkspaceAndNameDocument, options);
      }
export function useGetAppByWorkspaceAndNameLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppByWorkspaceAndNameQuery, GetAppByWorkspaceAndNameQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppByWorkspaceAndNameQuery, GetAppByWorkspaceAndNameQueryVariables>(GetAppByWorkspaceAndNameDocument, options);
        }
export type GetAppByWorkspaceAndNameQueryHookResult = ReturnType<typeof useGetAppByWorkspaceAndNameQuery>;
export type GetAppByWorkspaceAndNameLazyQueryHookResult = ReturnType<typeof useGetAppByWorkspaceAndNameLazyQuery>;
export type GetAppByWorkspaceAndNameQueryResult = Apollo.QueryResult<GetAppByWorkspaceAndNameQuery, GetAppByWorkspaceAndNameQueryVariables>;
export function refetchGetAppByWorkspaceAndNameQuery(variables: GetAppByWorkspaceAndNameQueryVariables) {
      return { query: GetAppByWorkspaceAndNameDocument, variables: variables }
    }
export const GetAppCustomClaimsDocument = gql`
    query getAppCustomClaims($id: uuid!) {
  app(id: $id) {
    id
    name
    authJwtCustomClaims
  }
}
    `;

/**
 * __useGetAppCustomClaimsQuery__
 *
 * To run a query within a React component, call `useGetAppCustomClaimsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppCustomClaimsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppCustomClaimsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppCustomClaimsQuery(baseOptions: Apollo.QueryHookOptions<GetAppCustomClaimsQuery, GetAppCustomClaimsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppCustomClaimsQuery, GetAppCustomClaimsQueryVariables>(GetAppCustomClaimsDocument, options);
      }
export function useGetAppCustomClaimsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppCustomClaimsQuery, GetAppCustomClaimsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppCustomClaimsQuery, GetAppCustomClaimsQueryVariables>(GetAppCustomClaimsDocument, options);
        }
export type GetAppCustomClaimsQueryHookResult = ReturnType<typeof useGetAppCustomClaimsQuery>;
export type GetAppCustomClaimsLazyQueryHookResult = ReturnType<typeof useGetAppCustomClaimsLazyQuery>;
export type GetAppCustomClaimsQueryResult = Apollo.QueryResult<GetAppCustomClaimsQuery, GetAppCustomClaimsQueryVariables>;
export function refetchGetAppCustomClaimsQuery(variables: GetAppCustomClaimsQueryVariables) {
      return { query: GetAppCustomClaimsDocument, variables: variables }
    }
export const GetAppInjectedVariablesDocument = gql`
    query getAppInjectedVariables($id: uuid!) {
  app(id: $id) {
    id
    webhookSecret
    hasuraGraphqlJwtSecret
  }
}
    `;

/**
 * __useGetAppInjectedVariablesQuery__
 *
 * To run a query within a React component, call `useGetAppInjectedVariablesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppInjectedVariablesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppInjectedVariablesQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppInjectedVariablesQuery(baseOptions: Apollo.QueryHookOptions<GetAppInjectedVariablesQuery, GetAppInjectedVariablesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppInjectedVariablesQuery, GetAppInjectedVariablesQueryVariables>(GetAppInjectedVariablesDocument, options);
      }
export function useGetAppInjectedVariablesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppInjectedVariablesQuery, GetAppInjectedVariablesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppInjectedVariablesQuery, GetAppInjectedVariablesQueryVariables>(GetAppInjectedVariablesDocument, options);
        }
export type GetAppInjectedVariablesQueryHookResult = ReturnType<typeof useGetAppInjectedVariablesQuery>;
export type GetAppInjectedVariablesLazyQueryHookResult = ReturnType<typeof useGetAppInjectedVariablesLazyQuery>;
export type GetAppInjectedVariablesQueryResult = Apollo.QueryResult<GetAppInjectedVariablesQuery, GetAppInjectedVariablesQueryVariables>;
export function refetchGetAppInjectedVariablesQuery(variables: GetAppInjectedVariablesQueryVariables) {
      return { query: GetAppInjectedVariablesDocument, variables: variables }
    }
export const GetAppRolesAndPermissionsDocument = gql`
    query getAppRolesAndPermissions($id: uuid!) {
  app(id: $id) {
    ...GetAppRoles
  }
}
    ${GetAppRolesFragmentDoc}`;

/**
 * __useGetAppRolesAndPermissionsQuery__
 *
 * To run a query within a React component, call `useGetAppRolesAndPermissionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppRolesAndPermissionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppRolesAndPermissionsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppRolesAndPermissionsQuery(baseOptions: Apollo.QueryHookOptions<GetAppRolesAndPermissionsQuery, GetAppRolesAndPermissionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppRolesAndPermissionsQuery, GetAppRolesAndPermissionsQueryVariables>(GetAppRolesAndPermissionsDocument, options);
      }
export function useGetAppRolesAndPermissionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppRolesAndPermissionsQuery, GetAppRolesAndPermissionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppRolesAndPermissionsQuery, GetAppRolesAndPermissionsQueryVariables>(GetAppRolesAndPermissionsDocument, options);
        }
export type GetAppRolesAndPermissionsQueryHookResult = ReturnType<typeof useGetAppRolesAndPermissionsQuery>;
export type GetAppRolesAndPermissionsLazyQueryHookResult = ReturnType<typeof useGetAppRolesAndPermissionsLazyQuery>;
export type GetAppRolesAndPermissionsQueryResult = Apollo.QueryResult<GetAppRolesAndPermissionsQuery, GetAppRolesAndPermissionsQueryVariables>;
export function refetchGetAppRolesAndPermissionsQuery(variables: GetAppRolesAndPermissionsQueryVariables) {
      return { query: GetAppRolesAndPermissionsDocument, variables: variables }
    }
export const GetApplicationBackupsDocument = gql`
    query getApplicationBackups($appId: uuid!) {
  app(id: $appId) {
    backups(order_by: {createdAt: desc}) {
      id
      size
      createdAt
      completedAt
    }
  }
}
    `;

/**
 * __useGetApplicationBackupsQuery__
 *
 * To run a query within a React component, call `useGetApplicationBackupsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationBackupsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationBackupsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetApplicationBackupsQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>(GetApplicationBackupsDocument, options);
      }
export function useGetApplicationBackupsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>(GetApplicationBackupsDocument, options);
        }
export type GetApplicationBackupsQueryHookResult = ReturnType<typeof useGetApplicationBackupsQuery>;
export type GetApplicationBackupsLazyQueryHookResult = ReturnType<typeof useGetApplicationBackupsLazyQuery>;
export type GetApplicationBackupsQueryResult = Apollo.QueryResult<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>;
export function refetchGetApplicationBackupsQuery(variables: GetApplicationBackupsQueryVariables) {
      return { query: GetApplicationBackupsDocument, variables: variables }
    }
export const GetApplicationPlanDocument = gql`
    query getApplicationPlan($workspace: String!, $slug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspace}}, slug: {_eq: $slug}}) {
    id
    subdomain
    plan {
      name
      price
      upatedAt
      featureMaxDbSize
    }
  }
}
    `;

/**
 * __useGetApplicationPlanQuery__
 *
 * To run a query within a React component, call `useGetApplicationPlanQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationPlanQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationPlanQuery({
 *   variables: {
 *      workspace: // value for 'workspace'
 *      slug: // value for 'slug'
 *   },
 * });
 */
export function useGetApplicationPlanQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>(GetApplicationPlanDocument, options);
      }
export function useGetApplicationPlanLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>(GetApplicationPlanDocument, options);
        }
export type GetApplicationPlanQueryHookResult = ReturnType<typeof useGetApplicationPlanQuery>;
export type GetApplicationPlanLazyQueryHookResult = ReturnType<typeof useGetApplicationPlanLazyQuery>;
export type GetApplicationPlanQueryResult = Apollo.QueryResult<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>;
export function refetchGetApplicationPlanQuery(variables: GetApplicationPlanQueryVariables) {
      return { query: GetApplicationPlanDocument, variables: variables }
    }
export const GetApplicationStateDocument = gql`
    query getApplicationState($appId: uuid!) {
  app(id: $appId) {
    id
    name
    appStates(order_by: {createdAt: desc}, limit: 10) {
      id
      appId
      message
      stateId
      createdAt
    }
  }
}
    `;

/**
 * __useGetApplicationStateQuery__
 *
 * To run a query within a React component, call `useGetApplicationStateQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationStateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationStateQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetApplicationStateQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationStateQuery, GetApplicationStateQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationStateQuery, GetApplicationStateQueryVariables>(GetApplicationStateDocument, options);
      }
export function useGetApplicationStateLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationStateQuery, GetApplicationStateQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationStateQuery, GetApplicationStateQueryVariables>(GetApplicationStateDocument, options);
        }
export type GetApplicationStateQueryHookResult = ReturnType<typeof useGetApplicationStateQuery>;
export type GetApplicationStateLazyQueryHookResult = ReturnType<typeof useGetApplicationStateLazyQuery>;
export type GetApplicationStateQueryResult = Apollo.QueryResult<GetApplicationStateQuery, GetApplicationStateQueryVariables>;
export function refetchGetApplicationStateQuery(variables: GetApplicationStateQueryVariables) {
      return { query: GetApplicationStateDocument, variables: variables }
    }
export const GetAppsDocument = gql`
    query getApps {
  apps(order_by: {createdAt: desc}) {
    id
    slug
    name
    subdomain
  }
}
    `;

/**
 * __useGetAppsQuery__
 *
 * To run a query within a React component, call `useGetAppsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAppsQuery(baseOptions?: Apollo.QueryHookOptions<GetAppsQuery, GetAppsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppsQuery, GetAppsQueryVariables>(GetAppsDocument, options);
      }
export function useGetAppsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppsQuery, GetAppsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppsQuery, GetAppsQueryVariables>(GetAppsDocument, options);
        }
export type GetAppsQueryHookResult = ReturnType<typeof useGetAppsQuery>;
export type GetAppsLazyQueryHookResult = ReturnType<typeof useGetAppsLazyQuery>;
export type GetAppsQueryResult = Apollo.QueryResult<GetAppsQuery, GetAppsQueryVariables>;
export function refetchGetAppsQuery(variables?: GetAppsQueryVariables) {
      return { query: GetAppsDocument, variables: variables }
    }
export const GetAppProvisionStatusDocument = gql`
    query getAppProvisionStatus($workspace: String!, $slug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspace}}, slug: {_eq: $slug}}) {
    id
    isProvisioned
    subdomain
    hasuraGraphqlAdminSecret
    createdAt
  }
}
    `;

/**
 * __useGetAppProvisionStatusQuery__
 *
 * To run a query within a React component, call `useGetAppProvisionStatusQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppProvisionStatusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppProvisionStatusQuery({
 *   variables: {
 *      workspace: // value for 'workspace'
 *      slug: // value for 'slug'
 *   },
 * });
 */
export function useGetAppProvisionStatusQuery(baseOptions: Apollo.QueryHookOptions<GetAppProvisionStatusQuery, GetAppProvisionStatusQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppProvisionStatusQuery, GetAppProvisionStatusQueryVariables>(GetAppProvisionStatusDocument, options);
      }
export function useGetAppProvisionStatusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppProvisionStatusQuery, GetAppProvisionStatusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppProvisionStatusQuery, GetAppProvisionStatusQueryVariables>(GetAppProvisionStatusDocument, options);
        }
export type GetAppProvisionStatusQueryHookResult = ReturnType<typeof useGetAppProvisionStatusQuery>;
export type GetAppProvisionStatusLazyQueryHookResult = ReturnType<typeof useGetAppProvisionStatusLazyQuery>;
export type GetAppProvisionStatusQueryResult = Apollo.QueryResult<GetAppProvisionStatusQuery, GetAppProvisionStatusQueryVariables>;
export function refetchGetAppProvisionStatusQuery(variables: GetAppProvisionStatusQueryVariables) {
      return { query: GetAppProvisionStatusDocument, variables: variables }
    }
export const GetPostgresCredentialsDocument = gql`
    query getPostgresCredentials($id: uuid!) {
  app(id: $id) {
    postgresUser
    postgresDatabase
    postgresPassword
    postgresHost
  }
}
    `;

/**
 * __useGetPostgresCredentialsQuery__
 *
 * To run a query within a React component, call `useGetPostgresCredentialsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPostgresCredentialsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPostgresCredentialsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetPostgresCredentialsQuery(baseOptions: Apollo.QueryHookOptions<GetPostgresCredentialsQuery, GetPostgresCredentialsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPostgresCredentialsQuery, GetPostgresCredentialsQueryVariables>(GetPostgresCredentialsDocument, options);
      }
export function useGetPostgresCredentialsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPostgresCredentialsQuery, GetPostgresCredentialsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPostgresCredentialsQuery, GetPostgresCredentialsQueryVariables>(GetPostgresCredentialsDocument, options);
        }
export type GetPostgresCredentialsQueryHookResult = ReturnType<typeof useGetPostgresCredentialsQuery>;
export type GetPostgresCredentialsLazyQueryHookResult = ReturnType<typeof useGetPostgresCredentialsLazyQuery>;
export type GetPostgresCredentialsQueryResult = Apollo.QueryResult<GetPostgresCredentialsQuery, GetPostgresCredentialsQueryVariables>;
export function refetchGetPostgresCredentialsQuery(variables: GetPostgresCredentialsQueryVariables) {
      return { query: GetPostgresCredentialsDocument, variables: variables }
    }
export const GetRolesDocument = gql`
    query getRoles($id: uuid!) {
  app(id: $id) {
    id
    authUserDefaultRole
    authUserDefaultAllowedRoles
  }
}
    `;

/**
 * __useGetRolesQuery__
 *
 * To run a query within a React component, call `useGetRolesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRolesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRolesQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRolesQuery(baseOptions: Apollo.QueryHookOptions<GetRolesQuery, GetRolesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRolesQuery, GetRolesQueryVariables>(GetRolesDocument, options);
      }
export function useGetRolesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRolesQuery, GetRolesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRolesQuery, GetRolesQueryVariables>(GetRolesDocument, options);
        }
export type GetRolesQueryHookResult = ReturnType<typeof useGetRolesQuery>;
export type GetRolesLazyQueryHookResult = ReturnType<typeof useGetRolesLazyQuery>;
export type GetRolesQueryResult = Apollo.QueryResult<GetRolesQuery, GetRolesQueryVariables>;
export function refetchGetRolesQuery(variables: GetRolesQueryVariables) {
      return { query: GetRolesDocument, variables: variables }
    }
export const GetRemoteAppRolesDocument = gql`
    query getRemoteAppRoles {
  authRoles {
    role
  }
}
    `;

/**
 * __useGetRemoteAppRolesQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppRolesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppRolesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppRolesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetRemoteAppRolesQuery(baseOptions?: Apollo.QueryHookOptions<GetRemoteAppRolesQuery, GetRemoteAppRolesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppRolesQuery, GetRemoteAppRolesQueryVariables>(GetRemoteAppRolesDocument, options);
      }
export function useGetRemoteAppRolesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppRolesQuery, GetRemoteAppRolesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppRolesQuery, GetRemoteAppRolesQueryVariables>(GetRemoteAppRolesDocument, options);
        }
export type GetRemoteAppRolesQueryHookResult = ReturnType<typeof useGetRemoteAppRolesQuery>;
export type GetRemoteAppRolesLazyQueryHookResult = ReturnType<typeof useGetRemoteAppRolesLazyQuery>;
export type GetRemoteAppRolesQueryResult = Apollo.QueryResult<GetRemoteAppRolesQuery, GetRemoteAppRolesQueryVariables>;
export function refetchGetRemoteAppRolesQuery(variables?: GetRemoteAppRolesQueryVariables) {
      return { query: GetRemoteAppRolesDocument, variables: variables }
    }
export const GetSmsSettingsDocument = gql`
    query getSMSSettings($id: uuid!) {
  app(id: $id) {
    id
    authSmsPasswordlessEnabled
    authSmsTwilioAccountSid
    authSmsTwilioAuthToken
    authSmsTwilioMessagingServiceId
    authSmsTwilioFrom
  }
}
    `;

/**
 * __useGetSmsSettingsQuery__
 *
 * To run a query within a React component, call `useGetSmsSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSmsSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSmsSettingsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetSmsSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetSmsSettingsQuery, GetSmsSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSmsSettingsQuery, GetSmsSettingsQueryVariables>(GetSmsSettingsDocument, options);
      }
export function useGetSmsSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSmsSettingsQuery, GetSmsSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSmsSettingsQuery, GetSmsSettingsQueryVariables>(GetSmsSettingsDocument, options);
        }
export type GetSmsSettingsQueryHookResult = ReturnType<typeof useGetSmsSettingsQuery>;
export type GetSmsSettingsLazyQueryHookResult = ReturnType<typeof useGetSmsSettingsLazyQuery>;
export type GetSmsSettingsQueryResult = Apollo.QueryResult<GetSmsSettingsQuery, GetSmsSettingsQueryVariables>;
export function refetchGetSmsSettingsQuery(variables: GetSmsSettingsQueryVariables) {
      return { query: GetSmsSettingsDocument, variables: variables }
    }
export const GetSmtpSettingsDocument = gql`
    query getSMTPSettings($id: uuid!) {
  app(id: $id) {
    id
    authSmtpSender
    authSmtpUser
    authSmtpHost
    authSmtpPort
    AuthSmtpSecure
    AuthSmtpAuthMethod
  }
}
    `;

/**
 * __useGetSmtpSettingsQuery__
 *
 * To run a query within a React component, call `useGetSmtpSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSmtpSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSmtpSettingsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetSmtpSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>(GetSmtpSettingsDocument, options);
      }
export function useGetSmtpSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>(GetSmtpSettingsDocument, options);
        }
export type GetSmtpSettingsQueryHookResult = ReturnType<typeof useGetSmtpSettingsQuery>;
export type GetSmtpSettingsLazyQueryHookResult = ReturnType<typeof useGetSmtpSettingsLazyQuery>;
export type GetSmtpSettingsQueryResult = Apollo.QueryResult<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>;
export function refetchGetSmtpSettingsQuery(variables: GetSmtpSettingsQueryVariables) {
      return { query: GetSmtpSettingsDocument, variables: variables }
    }
export const InsertApplicationDocument = gql`
    mutation insertApplication($app: apps_insert_input!) {
  insertApp(object: $app) {
    id
    name
    slug
    workspace {
      id
      name
      slug
    }
  }
}
    `;
export type InsertApplicationMutationFn = Apollo.MutationFunction<InsertApplicationMutation, InsertApplicationMutationVariables>;

/**
 * __useInsertApplicationMutation__
 *
 * To run a mutation, you first call `useInsertApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertApplicationMutation, { data, loading, error }] = useInsertApplicationMutation({
 *   variables: {
 *      app: // value for 'app'
 *   },
 * });
 */
export function useInsertApplicationMutation(baseOptions?: Apollo.MutationHookOptions<InsertApplicationMutation, InsertApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertApplicationMutation, InsertApplicationMutationVariables>(InsertApplicationDocument, options);
      }
export type InsertApplicationMutationHookResult = ReturnType<typeof useInsertApplicationMutation>;
export type InsertApplicationMutationResult = Apollo.MutationResult<InsertApplicationMutation>;
export type InsertApplicationMutationOptions = Apollo.BaseMutationOptions<InsertApplicationMutation, InsertApplicationMutationVariables>;
export const PrefetchNewAppDocument = gql`
    query PrefetchNewApp {
  regions(order_by: {city: asc}) {
    ...PrefetchNewAppRegions
  }
  plans(order_by: {sort: asc}) {
    ...PrefetchNewAppPlans
  }
  workspaces {
    ...PrefetchNewAppWorkspace
  }
}
    ${PrefetchNewAppRegionsFragmentDoc}
${PrefetchNewAppPlansFragmentDoc}
${PrefetchNewAppWorkspaceFragmentDoc}`;

/**
 * __usePrefetchNewAppQuery__
 *
 * To run a query within a React component, call `usePrefetchNewAppQuery` and pass it any options that fit your needs.
 * When your component renders, `usePrefetchNewAppQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePrefetchNewAppQuery({
 *   variables: {
 *   },
 * });
 */
export function usePrefetchNewAppQuery(baseOptions?: Apollo.QueryHookOptions<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>(PrefetchNewAppDocument, options);
      }
export function usePrefetchNewAppLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>(PrefetchNewAppDocument, options);
        }
export type PrefetchNewAppQueryHookResult = ReturnType<typeof usePrefetchNewAppQuery>;
export type PrefetchNewAppLazyQueryHookResult = ReturnType<typeof usePrefetchNewAppLazyQuery>;
export type PrefetchNewAppQueryResult = Apollo.QueryResult<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>;
export function refetchPrefetchNewAppQuery(variables?: PrefetchNewAppQueryVariables) {
      return { query: PrefetchNewAppDocument, variables: variables }
    }
export const UpdateAppDocument = gql`
    mutation updateApp($id: uuid!, $app: apps_set_input!) {
  updateApp(pk_columns: {id: $id}, _set: $app) {
    id
  }
}
    `;
export type UpdateAppMutationFn = Apollo.MutationFunction<UpdateAppMutation, UpdateAppMutationVariables>;

/**
 * __useUpdateAppMutation__
 *
 * To run a mutation, you first call `useUpdateAppMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateAppMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateAppMutation, { data, loading, error }] = useUpdateAppMutation({
 *   variables: {
 *      id: // value for 'id'
 *      app: // value for 'app'
 *   },
 * });
 */
export function useUpdateAppMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAppMutation, UpdateAppMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAppMutation, UpdateAppMutationVariables>(UpdateAppDocument, options);
      }
export type UpdateAppMutationHookResult = ReturnType<typeof useUpdateAppMutation>;
export type UpdateAppMutationResult = Apollo.MutationResult<UpdateAppMutation>;
export type UpdateAppMutationOptions = Apollo.BaseMutationOptions<UpdateAppMutation, UpdateAppMutationVariables>;
export const UpdateApplicationDocument = gql`
    mutation updateApplication($appId: uuid!, $app: apps_set_input!) {
  updateApp(pk_columns: {id: $appId}, _set: $app) {
    name
    id
    slug
  }
}
    `;
export type UpdateApplicationMutationFn = Apollo.MutationFunction<UpdateApplicationMutation, UpdateApplicationMutationVariables>;

/**
 * __useUpdateApplicationMutation__
 *
 * To run a mutation, you first call `useUpdateApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateApplicationMutation, { data, loading, error }] = useUpdateApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      app: // value for 'app'
 *   },
 * });
 */
export function useUpdateApplicationMutation(baseOptions?: Apollo.MutationHookOptions<UpdateApplicationMutation, UpdateApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateApplicationMutation, UpdateApplicationMutationVariables>(UpdateApplicationDocument, options);
      }
export type UpdateApplicationMutationHookResult = ReturnType<typeof useUpdateApplicationMutation>;
export type UpdateApplicationMutationResult = Apollo.MutationResult<UpdateApplicationMutation>;
export type UpdateApplicationMutationOptions = Apollo.BaseMutationOptions<UpdateApplicationMutation, UpdateApplicationMutationVariables>;
export const GetCountriesDocument = gql`
    query getCountries {
  countries(order_by: {name: asc}) {
    code
    name
  }
}
    `;

/**
 * __useGetCountriesQuery__
 *
 * To run a query within a React component, call `useGetCountriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCountriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCountriesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCountriesQuery(baseOptions?: Apollo.QueryHookOptions<GetCountriesQuery, GetCountriesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCountriesQuery, GetCountriesQueryVariables>(GetCountriesDocument, options);
      }
export function useGetCountriesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCountriesQuery, GetCountriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCountriesQuery, GetCountriesQueryVariables>(GetCountriesDocument, options);
        }
export type GetCountriesQueryHookResult = ReturnType<typeof useGetCountriesQuery>;
export type GetCountriesLazyQueryHookResult = ReturnType<typeof useGetCountriesLazyQuery>;
export type GetCountriesQueryResult = Apollo.QueryResult<GetCountriesQuery, GetCountriesQueryVariables>;
export function refetchGetCountriesQuery(variables?: GetCountriesQueryVariables) {
      return { query: GetCountriesDocument, variables: variables }
    }
export const ResetPostgresPasswordDocument = gql`
    mutation resetPostgresPassword($appID: String!, $newPassword: String!) {
  resetPostgresPassword(appID: $appID, newPassword: $newPassword)
}
    `;
export type ResetPostgresPasswordMutationFn = Apollo.MutationFunction<ResetPostgresPasswordMutation, ResetPostgresPasswordMutationVariables>;

/**
 * __useResetPostgresPasswordMutation__
 *
 * To run a mutation, you first call `useResetPostgresPasswordMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResetPostgresPasswordMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resetPostgresPasswordMutation, { data, loading, error }] = useResetPostgresPasswordMutation({
 *   variables: {
 *      appID: // value for 'appID'
 *      newPassword: // value for 'newPassword'
 *   },
 * });
 */
export function useResetPostgresPasswordMutation(baseOptions?: Apollo.MutationHookOptions<ResetPostgresPasswordMutation, ResetPostgresPasswordMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResetPostgresPasswordMutation, ResetPostgresPasswordMutationVariables>(ResetPostgresPasswordDocument, options);
      }
export type ResetPostgresPasswordMutationHookResult = ReturnType<typeof useResetPostgresPasswordMutation>;
export type ResetPostgresPasswordMutationResult = Apollo.MutationResult<ResetPostgresPasswordMutation>;
export type ResetPostgresPasswordMutationOptions = Apollo.BaseMutationOptions<ResetPostgresPasswordMutation, ResetPostgresPasswordMutationVariables>;
export const GetDeploymentsDocument = gql`
    query getDeployments($id: uuid!, $limit: Int!, $offset: Int!) {
  deployments(
    where: {appId: {_eq: $id}}
    order_by: {deploymentStartedAt: desc}
    limit: $limit
    offset: $offset
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useGetDeploymentsQuery__
 *
 * To run a query within a React component, call `useGetDeploymentsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDeploymentsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDeploymentsQuery({
 *   variables: {
 *      id: // value for 'id'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useGetDeploymentsQuery(baseOptions: Apollo.QueryHookOptions<GetDeploymentsQuery, GetDeploymentsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetDeploymentsQuery, GetDeploymentsQueryVariables>(GetDeploymentsDocument, options);
      }
export function useGetDeploymentsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetDeploymentsQuery, GetDeploymentsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetDeploymentsQuery, GetDeploymentsQueryVariables>(GetDeploymentsDocument, options);
        }
export type GetDeploymentsQueryHookResult = ReturnType<typeof useGetDeploymentsQuery>;
export type GetDeploymentsLazyQueryHookResult = ReturnType<typeof useGetDeploymentsLazyQuery>;
export type GetDeploymentsQueryResult = Apollo.QueryResult<GetDeploymentsQuery, GetDeploymentsQueryVariables>;
export function refetchGetDeploymentsQuery(variables: GetDeploymentsQueryVariables) {
      return { query: GetDeploymentsDocument, variables: variables }
    }
export const ScheduledOrPendingDeploymentsSubDocument = gql`
    subscription ScheduledOrPendingDeploymentsSub($appId: uuid!) {
  deployments(
    where: {deploymentStatus: {_in: ["PENDING", "SCHEDULED"]}, appId: {_eq: $appId}}
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useScheduledOrPendingDeploymentsSubSubscription__
 *
 * To run a query within a React component, call `useScheduledOrPendingDeploymentsSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useScheduledOrPendingDeploymentsSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useScheduledOrPendingDeploymentsSubSubscription({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useScheduledOrPendingDeploymentsSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<ScheduledOrPendingDeploymentsSubSubscription, ScheduledOrPendingDeploymentsSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<ScheduledOrPendingDeploymentsSubSubscription, ScheduledOrPendingDeploymentsSubSubscriptionVariables>(ScheduledOrPendingDeploymentsSubDocument, options);
      }
export type ScheduledOrPendingDeploymentsSubSubscriptionHookResult = ReturnType<typeof useScheduledOrPendingDeploymentsSubSubscription>;
export type ScheduledOrPendingDeploymentsSubSubscriptionResult = Apollo.SubscriptionResult<ScheduledOrPendingDeploymentsSubSubscription>;
export const LatestLiveDeploymentSubDocument = gql`
    subscription LatestLiveDeploymentSub($appId: uuid!) {
  deployments(
    where: {deploymentStatus: {_eq: "DEPLOYED"}, appId: {_eq: $appId}}
    order_by: {deploymentEndedAt: desc}
    limit: 1
    offset: 0
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useLatestLiveDeploymentSubSubscription__
 *
 * To run a query within a React component, call `useLatestLiveDeploymentSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useLatestLiveDeploymentSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLatestLiveDeploymentSubSubscription({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useLatestLiveDeploymentSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<LatestLiveDeploymentSubSubscription, LatestLiveDeploymentSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<LatestLiveDeploymentSubSubscription, LatestLiveDeploymentSubSubscriptionVariables>(LatestLiveDeploymentSubDocument, options);
      }
export type LatestLiveDeploymentSubSubscriptionHookResult = ReturnType<typeof useLatestLiveDeploymentSubSubscription>;
export type LatestLiveDeploymentSubSubscriptionResult = Apollo.SubscriptionResult<LatestLiveDeploymentSubSubscription>;
export const InsertDeploymentDocument = gql`
    mutation InsertDeployment($object: deployments_insert_input!) {
  insertDeployment(object: $object) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;
export type InsertDeploymentMutationFn = Apollo.MutationFunction<InsertDeploymentMutation, InsertDeploymentMutationVariables>;

/**
 * __useInsertDeploymentMutation__
 *
 * To run a mutation, you first call `useInsertDeploymentMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertDeploymentMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertDeploymentMutation, { data, loading, error }] = useInsertDeploymentMutation({
 *   variables: {
 *      object: // value for 'object'
 *   },
 * });
 */
export function useInsertDeploymentMutation(baseOptions?: Apollo.MutationHookOptions<InsertDeploymentMutation, InsertDeploymentMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertDeploymentMutation, InsertDeploymentMutationVariables>(InsertDeploymentDocument, options);
      }
export type InsertDeploymentMutationHookResult = ReturnType<typeof useInsertDeploymentMutation>;
export type InsertDeploymentMutationResult = Apollo.MutationResult<InsertDeploymentMutation>;
export type InsertDeploymentMutationOptions = Apollo.BaseMutationOptions<InsertDeploymentMutation, InsertDeploymentMutationVariables>;
export const GetDeploymentsSubDocument = gql`
    subscription getDeploymentsSub($id: uuid!, $limit: Int!, $offset: Int!) {
  deployments(
    where: {appId: {_eq: $id}}
    order_by: {deploymentStartedAt: desc}
    limit: $limit
    offset: $offset
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useGetDeploymentsSubSubscription__
 *
 * To run a query within a React component, call `useGetDeploymentsSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useGetDeploymentsSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDeploymentsSubSubscription({
 *   variables: {
 *      id: // value for 'id'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useGetDeploymentsSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<GetDeploymentsSubSubscription, GetDeploymentsSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<GetDeploymentsSubSubscription, GetDeploymentsSubSubscriptionVariables>(GetDeploymentsSubDocument, options);
      }
export type GetDeploymentsSubSubscriptionHookResult = ReturnType<typeof useGetDeploymentsSubSubscription>;
export type GetDeploymentsSubSubscriptionResult = Apollo.SubscriptionResult<GetDeploymentsSubSubscription>;
export const DeploymentSubDocument = gql`
    subscription deploymentSub($id: uuid!) {
  deployment(id: $id) {
    id
    commitMessage
    commitSHA
    commitUserName
    commitUserAvatarUrl
    deploymentStartedAt
    deploymentEndedAt
    deploymentStatus
    metadataStartedAt
    metadataEndedAt
    metadataStatus
    migrationsStartedAt
    migrationsEndedAt
    migrationsStatus
    functionsStartedAt
    functionsEndedAt
    functionsStatus
    deploymentLogs(order_by: {createdAt: asc}) {
      id
      createdAt
      message
    }
  }
}
    `;

/**
 * __useDeploymentSubSubscription__
 *
 * To run a query within a React component, call `useDeploymentSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useDeploymentSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDeploymentSubSubscription({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeploymentSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<DeploymentSubSubscription, DeploymentSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<DeploymentSubSubscription, DeploymentSubSubscriptionVariables>(DeploymentSubDocument, options);
      }
export type DeploymentSubSubscriptionHookResult = ReturnType<typeof useDeploymentSubSubscription>;
export type DeploymentSubSubscriptionResult = Apollo.SubscriptionResult<DeploymentSubSubscription>;
export const InsertFeatureFlagDocument = gql`
    mutation insertFeatureFlag($flag: featureFlags_insert_input!) {
  insertFeatureFlag(object: $flag) {
    id
  }
}
    `;
export type InsertFeatureFlagMutationFn = Apollo.MutationFunction<InsertFeatureFlagMutation, InsertFeatureFlagMutationVariables>;

/**
 * __useInsertFeatureFlagMutation__
 *
 * To run a mutation, you first call `useInsertFeatureFlagMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertFeatureFlagMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertFeatureFlagMutation, { data, loading, error }] = useInsertFeatureFlagMutation({
 *   variables: {
 *      flag: // value for 'flag'
 *   },
 * });
 */
export function useInsertFeatureFlagMutation(baseOptions?: Apollo.MutationHookOptions<InsertFeatureFlagMutation, InsertFeatureFlagMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertFeatureFlagMutation, InsertFeatureFlagMutationVariables>(InsertFeatureFlagDocument, options);
      }
export type InsertFeatureFlagMutationHookResult = ReturnType<typeof useInsertFeatureFlagMutation>;
export type InsertFeatureFlagMutationResult = Apollo.MutationResult<InsertFeatureFlagMutation>;
export type InsertFeatureFlagMutationOptions = Apollo.BaseMutationOptions<InsertFeatureFlagMutation, InsertFeatureFlagMutationVariables>;
export const DeleteFilesDocument = gql`
    mutation deleteFiles($fileIds: [uuid!]!) {
  deleteFiles(where: {id: {_in: $fileIds}}) {
    affected_rows
  }
}
    `;
export type DeleteFilesMutationFn = Apollo.MutationFunction<DeleteFilesMutation, DeleteFilesMutationVariables>;

/**
 * __useDeleteFilesMutation__
 *
 * To run a mutation, you first call `useDeleteFilesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteFilesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteFilesMutation, { data, loading, error }] = useDeleteFilesMutation({
 *   variables: {
 *      fileIds: // value for 'fileIds'
 *   },
 * });
 */
export function useDeleteFilesMutation(baseOptions?: Apollo.MutationHookOptions<DeleteFilesMutation, DeleteFilesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteFilesMutation, DeleteFilesMutationVariables>(DeleteFilesDocument, options);
      }
export type DeleteFilesMutationHookResult = ReturnType<typeof useDeleteFilesMutation>;
export type DeleteFilesMutationResult = Apollo.MutationResult<DeleteFilesMutation>;
export type DeleteFilesMutationOptions = Apollo.BaseMutationOptions<DeleteFilesMutation, DeleteFilesMutationVariables>;
export const GetBucketsDocument = gql`
    query getBuckets {
  buckets {
    id
    maxUploadFileSize
  }
}
    `;

/**
 * __useGetBucketsQuery__
 *
 * To run a query within a React component, call `useGetBucketsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBucketsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBucketsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetBucketsQuery(baseOptions?: Apollo.QueryHookOptions<GetBucketsQuery, GetBucketsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBucketsQuery, GetBucketsQueryVariables>(GetBucketsDocument, options);
      }
export function useGetBucketsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBucketsQuery, GetBucketsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBucketsQuery, GetBucketsQueryVariables>(GetBucketsDocument, options);
        }
export type GetBucketsQueryHookResult = ReturnType<typeof useGetBucketsQuery>;
export type GetBucketsLazyQueryHookResult = ReturnType<typeof useGetBucketsLazyQuery>;
export type GetBucketsQueryResult = Apollo.QueryResult<GetBucketsQuery, GetBucketsQueryVariables>;
export function refetchGetBucketsQuery(variables?: GetBucketsQueryVariables) {
      return { query: GetBucketsDocument, variables: variables }
    }
export const GetFilesDocument = gql`
    query getFiles($where: files_bool_exp, $limit: Int, $offset: Int, $order_by: [files_order_by!]) {
  files(where: $where, limit: $limit, offset: $offset, order_by: $order_by) {
    id
    bucketId
    createdAt
    updatedAt
    name
    size
    mimeType
    etag
    isUploaded
    uploadedByUserId
  }
}
    `;

/**
 * __useGetFilesQuery__
 *
 * To run a query within a React component, call `useGetFilesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetFilesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetFilesQuery({
 *   variables: {
 *      where: // value for 'where'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *      order_by: // value for 'order_by'
 *   },
 * });
 */
export function useGetFilesQuery(baseOptions?: Apollo.QueryHookOptions<GetFilesQuery, GetFilesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFilesQuery, GetFilesQueryVariables>(GetFilesDocument, options);
      }
export function useGetFilesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFilesQuery, GetFilesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFilesQuery, GetFilesQueryVariables>(GetFilesDocument, options);
        }
export type GetFilesQueryHookResult = ReturnType<typeof useGetFilesQuery>;
export type GetFilesLazyQueryHookResult = ReturnType<typeof useGetFilesLazyQuery>;
export type GetFilesQueryResult = Apollo.QueryResult<GetFilesQuery, GetFilesQueryVariables>;
export function refetchGetFilesQuery(variables?: GetFilesQueryVariables) {
      return { query: GetFilesDocument, variables: variables }
    }
export const GetFilesAggregateDocument = gql`
    query getFilesAggregate($where: files_bool_exp) {
  filesAggregate(where: $where) {
    aggregate {
      count
    }
  }
}
    `;

/**
 * __useGetFilesAggregateQuery__
 *
 * To run a query within a React component, call `useGetFilesAggregateQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetFilesAggregateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetFilesAggregateQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetFilesAggregateQuery(baseOptions?: Apollo.QueryHookOptions<GetFilesAggregateQuery, GetFilesAggregateQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFilesAggregateQuery, GetFilesAggregateQueryVariables>(GetFilesAggregateDocument, options);
      }
export function useGetFilesAggregateLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFilesAggregateQuery, GetFilesAggregateQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFilesAggregateQuery, GetFilesAggregateQueryVariables>(GetFilesAggregateDocument, options);
        }
export type GetFilesAggregateQueryHookResult = ReturnType<typeof useGetFilesAggregateQuery>;
export type GetFilesAggregateLazyQueryHookResult = ReturnType<typeof useGetFilesAggregateLazyQuery>;
export type GetFilesAggregateQueryResult = Apollo.QueryResult<GetFilesAggregateQuery, GetFilesAggregateQueryVariables>;
export function refetchGetFilesAggregateQuery(variables?: GetFilesAggregateQueryVariables) {
      return { query: GetFilesAggregateDocument, variables: variables }
    }
export const GetGithubRepositoriesDocument = gql`
    query getGithubRepositories {
  githubRepositories {
    ...GithubRepository
  }
  githubAppInstallations {
    id
    accountLogin
    accountType
    accountAvatarUrl
  }
}
    ${GithubRepositoryFragmentDoc}`;

/**
 * __useGetGithubRepositoriesQuery__
 *
 * To run a query within a React component, call `useGetGithubRepositoriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetGithubRepositoriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetGithubRepositoriesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetGithubRepositoriesQuery(baseOptions?: Apollo.QueryHookOptions<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>(GetGithubRepositoriesDocument, options);
      }
export function useGetGithubRepositoriesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>(GetGithubRepositoriesDocument, options);
        }
export type GetGithubRepositoriesQueryHookResult = ReturnType<typeof useGetGithubRepositoriesQuery>;
export type GetGithubRepositoriesLazyQueryHookResult = ReturnType<typeof useGetGithubRepositoriesLazyQuery>;
export type GetGithubRepositoriesQueryResult = Apollo.QueryResult<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>;
export function refetchGetGithubRepositoriesQuery(variables?: GetGithubRepositoriesQueryVariables) {
      return { query: GetGithubRepositoriesDocument, variables: variables }
    }
export const GetProjectLogsDocument = gql`
    query getProjectLogs($appID: String!, $service: String, $from: Timestamp, $to: Timestamp) {
  logs(appID: $appID, service: $service, from: $from, to: $to) {
    log
    service
    timestamp
  }
}
    `;

/**
 * __useGetProjectLogsQuery__
 *
 * To run a query within a React component, call `useGetProjectLogsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetProjectLogsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetProjectLogsQuery({
 *   variables: {
 *      appID: // value for 'appID'
 *      service: // value for 'service'
 *      from: // value for 'from'
 *      to: // value for 'to'
 *   },
 * });
 */
export function useGetProjectLogsQuery(baseOptions: Apollo.QueryHookOptions<GetProjectLogsQuery, GetProjectLogsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetProjectLogsQuery, GetProjectLogsQueryVariables>(GetProjectLogsDocument, options);
      }
export function useGetProjectLogsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetProjectLogsQuery, GetProjectLogsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetProjectLogsQuery, GetProjectLogsQueryVariables>(GetProjectLogsDocument, options);
        }
export type GetProjectLogsQueryHookResult = ReturnType<typeof useGetProjectLogsQuery>;
export type GetProjectLogsLazyQueryHookResult = ReturnType<typeof useGetProjectLogsLazyQuery>;
export type GetProjectLogsQueryResult = Apollo.QueryResult<GetProjectLogsQuery, GetProjectLogsQueryVariables>;
export function refetchGetProjectLogsQuery(variables: GetProjectLogsQueryVariables) {
      return { query: GetProjectLogsDocument, variables: variables }
    }
export const GetLogsSubscriptionDocument = gql`
    subscription getLogsSubscription($appID: String!, $service: String, $from: Timestamp) {
  logs(appID: $appID, service: $service, from: $from) {
    log
    service
    timestamp
  }
}
    `;

/**
 * __useGetLogsSubscriptionSubscription__
 *
 * To run a query within a React component, call `useGetLogsSubscriptionSubscription` and pass it any options that fit your needs.
 * When your component renders, `useGetLogsSubscriptionSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetLogsSubscriptionSubscription({
 *   variables: {
 *      appID: // value for 'appID'
 *      service: // value for 'service'
 *      from: // value for 'from'
 *   },
 * });
 */
export function useGetLogsSubscriptionSubscription(baseOptions: Apollo.SubscriptionHookOptions<GetLogsSubscriptionSubscription, GetLogsSubscriptionSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<GetLogsSubscriptionSubscription, GetLogsSubscriptionSubscriptionVariables>(GetLogsSubscriptionDocument, options);
      }
export type GetLogsSubscriptionSubscriptionHookResult = ReturnType<typeof useGetLogsSubscriptionSubscription>;
export type GetLogsSubscriptionSubscriptionResult = Apollo.SubscriptionResult<GetLogsSubscriptionSubscription>;
export const ChangePaymentMethodDocument = gql`
    mutation changePaymentMethod($workspaceId: uuid!, $paymentMethod: paymentMethods_insert_input!) {
  deletePaymentMethods(where: {workspaceId: {_eq: $workspaceId}}) {
    affected_rows
  }
  insertPaymentMethod(object: $paymentMethod) {
    id
  }
}
    `;
export type ChangePaymentMethodMutationFn = Apollo.MutationFunction<ChangePaymentMethodMutation, ChangePaymentMethodMutationVariables>;

/**
 * __useChangePaymentMethodMutation__
 *
 * To run a mutation, you first call `useChangePaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useChangePaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [changePaymentMethodMutation, { data, loading, error }] = useChangePaymentMethodMutation({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *      paymentMethod: // value for 'paymentMethod'
 *   },
 * });
 */
export function useChangePaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<ChangePaymentMethodMutation, ChangePaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ChangePaymentMethodMutation, ChangePaymentMethodMutationVariables>(ChangePaymentMethodDocument, options);
      }
export type ChangePaymentMethodMutationHookResult = ReturnType<typeof useChangePaymentMethodMutation>;
export type ChangePaymentMethodMutationResult = Apollo.MutationResult<ChangePaymentMethodMutation>;
export type ChangePaymentMethodMutationOptions = Apollo.BaseMutationOptions<ChangePaymentMethodMutation, ChangePaymentMethodMutationVariables>;
export const DeletePaymentMethodDocument = gql`
    mutation deletePaymentMethod($paymentMethodId: uuid!) {
  deletePaymentMethod(id: $paymentMethodId) {
    id
  }
}
    `;
export type DeletePaymentMethodMutationFn = Apollo.MutationFunction<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>;

/**
 * __useDeletePaymentMethodMutation__
 *
 * To run a mutation, you first call `useDeletePaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeletePaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deletePaymentMethodMutation, { data, loading, error }] = useDeletePaymentMethodMutation({
 *   variables: {
 *      paymentMethodId: // value for 'paymentMethodId'
 *   },
 * });
 */
export function useDeletePaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>(DeletePaymentMethodDocument, options);
      }
export type DeletePaymentMethodMutationHookResult = ReturnType<typeof useDeletePaymentMethodMutation>;
export type DeletePaymentMethodMutationResult = Apollo.MutationResult<DeletePaymentMethodMutation>;
export type DeletePaymentMethodMutationOptions = Apollo.BaseMutationOptions<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>;
export const GetPaymentMethodsDocument = gql`
    query getPaymentMethods($workspaceId: uuid!) {
  paymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    order_by: {createdAt: desc}
  ) {
    ...getPaymentMethods
  }
}
    ${GetPaymentMethodsFragmentDoc}`;

/**
 * __useGetPaymentMethodsQuery__
 *
 * To run a query within a React component, call `useGetPaymentMethodsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPaymentMethodsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPaymentMethodsQuery({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *   },
 * });
 */
export function useGetPaymentMethodsQuery(baseOptions: Apollo.QueryHookOptions<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>(GetPaymentMethodsDocument, options);
      }
export function useGetPaymentMethodsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>(GetPaymentMethodsDocument, options);
        }
export type GetPaymentMethodsQueryHookResult = ReturnType<typeof useGetPaymentMethodsQuery>;
export type GetPaymentMethodsLazyQueryHookResult = ReturnType<typeof useGetPaymentMethodsLazyQuery>;
export type GetPaymentMethodsQueryResult = Apollo.QueryResult<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>;
export function refetchGetPaymentMethodsQuery(variables: GetPaymentMethodsQueryVariables) {
      return { query: GetPaymentMethodsDocument, variables: variables }
    }
export const InsertNewPaymentMethodDocument = gql`
    mutation insertNewPaymentMethod($workspaceId: uuid!, $paymentMethod: paymentMethods_insert_input!) {
  updatePaymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    _set: {isDefault: false}
  ) {
    affected_rows
  }
  insertPaymentMethod(object: $paymentMethod) {
    id
  }
}
    `;
export type InsertNewPaymentMethodMutationFn = Apollo.MutationFunction<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>;

/**
 * __useInsertNewPaymentMethodMutation__
 *
 * To run a mutation, you first call `useInsertNewPaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertNewPaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertNewPaymentMethodMutation, { data, loading, error }] = useInsertNewPaymentMethodMutation({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *      paymentMethod: // value for 'paymentMethod'
 *   },
 * });
 */
export function useInsertNewPaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>(InsertNewPaymentMethodDocument, options);
      }
export type InsertNewPaymentMethodMutationHookResult = ReturnType<typeof useInsertNewPaymentMethodMutation>;
export type InsertNewPaymentMethodMutationResult = Apollo.MutationResult<InsertNewPaymentMethodMutation>;
export type InsertNewPaymentMethodMutationOptions = Apollo.BaseMutationOptions<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>;
export const SetNewDefaultPaymentMethodDocument = gql`
    mutation setNewDefaultPaymentMethod($workspaceId: uuid!, $paymentMethodId: uuid!) {
  setAllPaymentMethodToDefaultFalse: updatePaymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    _set: {isDefault: false}
  ) {
    affected_rows
  }
  updatePaymentMethods(
    where: {id: {_eq: $paymentMethodId}}
    _set: {isDefault: true}
  ) {
    affected_rows
  }
}
    `;
export type SetNewDefaultPaymentMethodMutationFn = Apollo.MutationFunction<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>;

/**
 * __useSetNewDefaultPaymentMethodMutation__
 *
 * To run a mutation, you first call `useSetNewDefaultPaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetNewDefaultPaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setNewDefaultPaymentMethodMutation, { data, loading, error }] = useSetNewDefaultPaymentMethodMutation({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *      paymentMethodId: // value for 'paymentMethodId'
 *   },
 * });
 */
export function useSetNewDefaultPaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>(SetNewDefaultPaymentMethodDocument, options);
      }
export type SetNewDefaultPaymentMethodMutationHookResult = ReturnType<typeof useSetNewDefaultPaymentMethodMutation>;
export type SetNewDefaultPaymentMethodMutationResult = Apollo.MutationResult<SetNewDefaultPaymentMethodMutation>;
export type SetNewDefaultPaymentMethodMutationOptions = Apollo.BaseMutationOptions<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>;
export const GetPlansDocument = gql`
    query getPlans {
  plans(order_by: {sort: asc}) {
    id
    name
    isFree
    price
    isDefault
  }
  regions {
    id
    isGdprCompliant
    city
    country {
      name
      continent {
        name
      }
    }
  }
  workspaces {
    id
    name
    slug
    paymentMethods {
      id
      cardBrand
      cardLast4
    }
  }
}
    `;

/**
 * __useGetPlansQuery__
 *
 * To run a query within a React component, call `useGetPlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPlansQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetPlansQuery(baseOptions?: Apollo.QueryHookOptions<GetPlansQuery, GetPlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPlansQuery, GetPlansQueryVariables>(GetPlansDocument, options);
      }
export function useGetPlansLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPlansQuery, GetPlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPlansQuery, GetPlansQueryVariables>(GetPlansDocument, options);
        }
export type GetPlansQueryHookResult = ReturnType<typeof useGetPlansQuery>;
export type GetPlansLazyQueryHookResult = ReturnType<typeof useGetPlansLazyQuery>;
export type GetPlansQueryResult = Apollo.QueryResult<GetPlansQuery, GetPlansQueryVariables>;
export function refetchGetPlansQuery(variables?: GetPlansQueryVariables) {
      return { query: GetPlansDocument, variables: variables }
    }
export const RestoreApplicationDatabaseDocument = gql`
    mutation RestoreApplicationDatabase($appId: String!, $backupId: String!) {
  restoreApplicationDatabase(appID: $appId, backupID: $backupId)
}
    `;
export type RestoreApplicationDatabaseMutationFn = Apollo.MutationFunction<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>;

/**
 * __useRestoreApplicationDatabaseMutation__
 *
 * To run a mutation, you first call `useRestoreApplicationDatabaseMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestoreApplicationDatabaseMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restoreApplicationDatabaseMutation, { data, loading, error }] = useRestoreApplicationDatabaseMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      backupId: // value for 'backupId'
 *   },
 * });
 */
export function useRestoreApplicationDatabaseMutation(baseOptions?: Apollo.MutationHookOptions<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>(RestoreApplicationDatabaseDocument, options);
      }
export type RestoreApplicationDatabaseMutationHookResult = ReturnType<typeof useRestoreApplicationDatabaseMutation>;
export type RestoreApplicationDatabaseMutationResult = Apollo.MutationResult<RestoreApplicationDatabaseMutation>;
export type RestoreApplicationDatabaseMutationOptions = Apollo.BaseMutationOptions<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>;
export const RemoteAppDeleteUserDocument = gql`
    mutation remoteAppDeleteUser($id: uuid!) {
  deleteUser(id: $id) {
    id
  }
}
    `;
export type RemoteAppDeleteUserMutationFn = Apollo.MutationFunction<RemoteAppDeleteUserMutation, RemoteAppDeleteUserMutationVariables>;

/**
 * __useRemoteAppDeleteUserMutation__
 *
 * To run a mutation, you first call `useRemoteAppDeleteUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoteAppDeleteUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [remoteAppDeleteUserMutation, { data, loading, error }] = useRemoteAppDeleteUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoteAppDeleteUserMutation(baseOptions?: Apollo.MutationHookOptions<RemoteAppDeleteUserMutation, RemoteAppDeleteUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoteAppDeleteUserMutation, RemoteAppDeleteUserMutationVariables>(RemoteAppDeleteUserDocument, options);
      }
export type RemoteAppDeleteUserMutationHookResult = ReturnType<typeof useRemoteAppDeleteUserMutation>;
export type RemoteAppDeleteUserMutationResult = Apollo.MutationResult<RemoteAppDeleteUserMutation>;
export type RemoteAppDeleteUserMutationOptions = Apollo.BaseMutationOptions<RemoteAppDeleteUserMutation, RemoteAppDeleteUserMutationVariables>;
export const GetAppFunctionsMetadataDocument = gql`
    query getAppFunctionsMetadata($id: uuid!) {
  app(id: $id) {
    metadataFunctions
  }
}
    `;

/**
 * __useGetAppFunctionsMetadataQuery__
 *
 * To run a query within a React component, call `useGetAppFunctionsMetadataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppFunctionsMetadataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppFunctionsMetadataQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppFunctionsMetadataQuery(baseOptions: Apollo.QueryHookOptions<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>(GetAppFunctionsMetadataDocument, options);
      }
export function useGetAppFunctionsMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>(GetAppFunctionsMetadataDocument, options);
        }
export type GetAppFunctionsMetadataQueryHookResult = ReturnType<typeof useGetAppFunctionsMetadataQuery>;
export type GetAppFunctionsMetadataLazyQueryHookResult = ReturnType<typeof useGetAppFunctionsMetadataLazyQuery>;
export type GetAppFunctionsMetadataQueryResult = Apollo.QueryResult<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>;
export function refetchGetAppFunctionsMetadataQuery(variables: GetAppFunctionsMetadataQueryVariables) {
      return { query: GetAppFunctionsMetadataDocument, variables: variables }
    }
export const GetAuthSettingsDocument = gql`
    query getAuthSettings($id: uuid!) {
  app(id: $id) {
    authAnonymousUsersEnabled
    authDisableNewUsers
    authPasswordMinLength
    authMfaEnabled
    authMfaTotpIssuer
    authAccessControlAllowedRedirectUrls
  }
}
    `;

/**
 * __useGetAuthSettingsQuery__
 *
 * To run a query within a React component, call `useGetAuthSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAuthSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAuthSettingsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAuthSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetAuthSettingsQuery, GetAuthSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAuthSettingsQuery, GetAuthSettingsQueryVariables>(GetAuthSettingsDocument, options);
      }
export function useGetAuthSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAuthSettingsQuery, GetAuthSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAuthSettingsQuery, GetAuthSettingsQueryVariables>(GetAuthSettingsDocument, options);
        }
export type GetAuthSettingsQueryHookResult = ReturnType<typeof useGetAuthSettingsQuery>;
export type GetAuthSettingsLazyQueryHookResult = ReturnType<typeof useGetAuthSettingsLazyQuery>;
export type GetAuthSettingsQueryResult = Apollo.QueryResult<GetAuthSettingsQuery, GetAuthSettingsQueryVariables>;
export function refetchGetAuthSettingsQuery(variables: GetAuthSettingsQueryVariables) {
      return { query: GetAuthSettingsDocument, variables: variables }
    }
export const GetRemoteAppFilesUsageDocument = gql`
    query getRemoteAppFilesUsage {
  filesAggregate {
    aggregate {
      count
      sum {
        size
      }
    }
  }
}
    `;

/**
 * __useGetRemoteAppFilesUsageQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppFilesUsageQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppFilesUsageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppFilesUsageQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetRemoteAppFilesUsageQuery(baseOptions?: Apollo.QueryHookOptions<GetRemoteAppFilesUsageQuery, GetRemoteAppFilesUsageQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppFilesUsageQuery, GetRemoteAppFilesUsageQueryVariables>(GetRemoteAppFilesUsageDocument, options);
      }
export function useGetRemoteAppFilesUsageLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppFilesUsageQuery, GetRemoteAppFilesUsageQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppFilesUsageQuery, GetRemoteAppFilesUsageQueryVariables>(GetRemoteAppFilesUsageDocument, options);
        }
export type GetRemoteAppFilesUsageQueryHookResult = ReturnType<typeof useGetRemoteAppFilesUsageQuery>;
export type GetRemoteAppFilesUsageLazyQueryHookResult = ReturnType<typeof useGetRemoteAppFilesUsageLazyQuery>;
export type GetRemoteAppFilesUsageQueryResult = Apollo.QueryResult<GetRemoteAppFilesUsageQuery, GetRemoteAppFilesUsageQueryVariables>;
export function refetchGetRemoteAppFilesUsageQuery(variables?: GetRemoteAppFilesUsageQueryVariables) {
      return { query: GetRemoteAppFilesUsageDocument, variables: variables }
    }
export const GetFunctionsLogsDocument = gql`
    query getFunctionsLogs($subdomain: String!) {
  getFunctionLogs(subdomain: $subdomain) {
    functionPath
    createdAt
    message
  }
}
    `;

/**
 * __useGetFunctionsLogsQuery__
 *
 * To run a query within a React component, call `useGetFunctionsLogsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetFunctionsLogsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetFunctionsLogsQuery({
 *   variables: {
 *      subdomain: // value for 'subdomain'
 *   },
 * });
 */
export function useGetFunctionsLogsQuery(baseOptions: Apollo.QueryHookOptions<GetFunctionsLogsQuery, GetFunctionsLogsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFunctionsLogsQuery, GetFunctionsLogsQueryVariables>(GetFunctionsLogsDocument, options);
      }
export function useGetFunctionsLogsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFunctionsLogsQuery, GetFunctionsLogsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFunctionsLogsQuery, GetFunctionsLogsQueryVariables>(GetFunctionsLogsDocument, options);
        }
export type GetFunctionsLogsQueryHookResult = ReturnType<typeof useGetFunctionsLogsQuery>;
export type GetFunctionsLogsLazyQueryHookResult = ReturnType<typeof useGetFunctionsLogsLazyQuery>;
export type GetFunctionsLogsQueryResult = Apollo.QueryResult<GetFunctionsLogsQuery, GetFunctionsLogsQueryVariables>;
export function refetchGetFunctionsLogsQuery(variables: GetFunctionsLogsQueryVariables) {
      return { query: GetFunctionsLogsDocument, variables: variables }
    }
export const GetFunctionLogDocument = gql`
    query getFunctionLog($subdomain: String!, $functionPaths: [String!]) {
  getFunctionLogs(subdomain: $subdomain, functionPaths: $functionPaths) {
    functionPath
    createdAt
    message
  }
}
    `;

/**
 * __useGetFunctionLogQuery__
 *
 * To run a query within a React component, call `useGetFunctionLogQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetFunctionLogQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetFunctionLogQuery({
 *   variables: {
 *      subdomain: // value for 'subdomain'
 *      functionPaths: // value for 'functionPaths'
 *   },
 * });
 */
export function useGetFunctionLogQuery(baseOptions: Apollo.QueryHookOptions<GetFunctionLogQuery, GetFunctionLogQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFunctionLogQuery, GetFunctionLogQueryVariables>(GetFunctionLogDocument, options);
      }
export function useGetFunctionLogLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFunctionLogQuery, GetFunctionLogQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFunctionLogQuery, GetFunctionLogQueryVariables>(GetFunctionLogDocument, options);
        }
export type GetFunctionLogQueryHookResult = ReturnType<typeof useGetFunctionLogQuery>;
export type GetFunctionLogLazyQueryHookResult = ReturnType<typeof useGetFunctionLogLazyQuery>;
export type GetFunctionLogQueryResult = Apollo.QueryResult<GetFunctionLogQuery, GetFunctionLogQueryVariables>;
export function refetchGetFunctionLogQuery(variables: GetFunctionLogQueryVariables) {
      return { query: GetFunctionLogDocument, variables: variables }
    }
export const GetGravatarSettingsDocument = gql`
    query getGravatarSettings($id: uuid!) {
  app(id: $id) {
    authGravatarEnabled
    authGravatarDefault
    authGravatarRating
  }
}
    `;

/**
 * __useGetGravatarSettingsQuery__
 *
 * To run a query within a React component, call `useGetGravatarSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetGravatarSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetGravatarSettingsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetGravatarSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetGravatarSettingsQuery, GetGravatarSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetGravatarSettingsQuery, GetGravatarSettingsQueryVariables>(GetGravatarSettingsDocument, options);
      }
export function useGetGravatarSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetGravatarSettingsQuery, GetGravatarSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetGravatarSettingsQuery, GetGravatarSettingsQueryVariables>(GetGravatarSettingsDocument, options);
        }
export type GetGravatarSettingsQueryHookResult = ReturnType<typeof useGetGravatarSettingsQuery>;
export type GetGravatarSettingsLazyQueryHookResult = ReturnType<typeof useGetGravatarSettingsLazyQuery>;
export type GetGravatarSettingsQueryResult = Apollo.QueryResult<GetGravatarSettingsQuery, GetGravatarSettingsQueryVariables>;
export function refetchGetGravatarSettingsQuery(variables: GetGravatarSettingsQueryVariables) {
      return { query: GetGravatarSettingsDocument, variables: variables }
    }
export const GetRemoteAppMetricsDocument = gql`
    query getRemoteAppMetrics {
  filesAggregate {
    aggregate {
      count
      sum {
        size
      }
    }
  }
  usersAggregate {
    aggregate {
      count
    }
  }
}
    `;

/**
 * __useGetRemoteAppMetricsQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppMetricsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppMetricsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppMetricsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetRemoteAppMetricsQuery(baseOptions?: Apollo.QueryHookOptions<GetRemoteAppMetricsQuery, GetRemoteAppMetricsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppMetricsQuery, GetRemoteAppMetricsQueryVariables>(GetRemoteAppMetricsDocument, options);
      }
export function useGetRemoteAppMetricsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppMetricsQuery, GetRemoteAppMetricsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppMetricsQuery, GetRemoteAppMetricsQueryVariables>(GetRemoteAppMetricsDocument, options);
        }
export type GetRemoteAppMetricsQueryHookResult = ReturnType<typeof useGetRemoteAppMetricsQuery>;
export type GetRemoteAppMetricsLazyQueryHookResult = ReturnType<typeof useGetRemoteAppMetricsLazyQuery>;
export type GetRemoteAppMetricsQueryResult = Apollo.QueryResult<GetRemoteAppMetricsQuery, GetRemoteAppMetricsQueryVariables>;
export function refetchGetRemoteAppMetricsQuery(variables?: GetRemoteAppMetricsQueryVariables) {
      return { query: GetRemoteAppMetricsDocument, variables: variables }
    }
export const GetRemoteAppUserDocument = gql`
    query getRemoteAppUser($id: uuid!) {
  user(id: $id) {
    ...GetRemoteAppUser
  }
  authRoles {
    role
  }
}
    ${GetRemoteAppUserFragmentDoc}`;

/**
 * __useGetRemoteAppUserQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppUserQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRemoteAppUserQuery(baseOptions: Apollo.QueryHookOptions<GetRemoteAppUserQuery, GetRemoteAppUserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppUserQuery, GetRemoteAppUserQueryVariables>(GetRemoteAppUserDocument, options);
      }
export function useGetRemoteAppUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppUserQuery, GetRemoteAppUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppUserQuery, GetRemoteAppUserQueryVariables>(GetRemoteAppUserDocument, options);
        }
export type GetRemoteAppUserQueryHookResult = ReturnType<typeof useGetRemoteAppUserQuery>;
export type GetRemoteAppUserLazyQueryHookResult = ReturnType<typeof useGetRemoteAppUserLazyQuery>;
export type GetRemoteAppUserQueryResult = Apollo.QueryResult<GetRemoteAppUserQuery, GetRemoteAppUserQueryVariables>;
export function refetchGetRemoteAppUserQuery(variables: GetRemoteAppUserQueryVariables) {
      return { query: GetRemoteAppUserDocument, variables: variables }
    }
export const GetRemoteAppUserWhereDocument = gql`
    query getRemoteAppUserWhere($where: users_bool_exp!) {
  users(where: $where) {
    id
    displayName
    email
    defaultRole
  }
}
    `;

/**
 * __useGetRemoteAppUserWhereQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppUserWhereQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppUserWhereQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppUserWhereQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetRemoteAppUserWhereQuery(baseOptions: Apollo.QueryHookOptions<GetRemoteAppUserWhereQuery, GetRemoteAppUserWhereQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppUserWhereQuery, GetRemoteAppUserWhereQueryVariables>(GetRemoteAppUserWhereDocument, options);
      }
export function useGetRemoteAppUserWhereLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppUserWhereQuery, GetRemoteAppUserWhereQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppUserWhereQuery, GetRemoteAppUserWhereQueryVariables>(GetRemoteAppUserWhereDocument, options);
        }
export type GetRemoteAppUserWhereQueryHookResult = ReturnType<typeof useGetRemoteAppUserWhereQuery>;
export type GetRemoteAppUserWhereLazyQueryHookResult = ReturnType<typeof useGetRemoteAppUserWhereLazyQuery>;
export type GetRemoteAppUserWhereQueryResult = Apollo.QueryResult<GetRemoteAppUserWhereQuery, GetRemoteAppUserWhereQueryVariables>;
export function refetchGetRemoteAppUserWhereQuery(variables: GetRemoteAppUserWhereQueryVariables) {
      return { query: GetRemoteAppUserWhereDocument, variables: variables }
    }
export const GetRemoteAppByIdDocument = gql`
    query getRemoteAppById($id: uuid!) {
  user(id: $id) {
    id
    displayName
    email
  }
}
    `;

/**
 * __useGetRemoteAppByIdQuery__
 *
 * To run a query within a React component, call `useGetRemoteAppByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRemoteAppByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRemoteAppByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRemoteAppByIdQuery(baseOptions: Apollo.QueryHookOptions<GetRemoteAppByIdQuery, GetRemoteAppByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRemoteAppByIdQuery, GetRemoteAppByIdQueryVariables>(GetRemoteAppByIdDocument, options);
      }
export function useGetRemoteAppByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRemoteAppByIdQuery, GetRemoteAppByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRemoteAppByIdQuery, GetRemoteAppByIdQueryVariables>(GetRemoteAppByIdDocument, options);
        }
export type GetRemoteAppByIdQueryHookResult = ReturnType<typeof useGetRemoteAppByIdQuery>;
export type GetRemoteAppByIdLazyQueryHookResult = ReturnType<typeof useGetRemoteAppByIdLazyQuery>;
export type GetRemoteAppByIdQueryResult = Apollo.QueryResult<GetRemoteAppByIdQuery, GetRemoteAppByIdQueryVariables>;
export function refetchGetRemoteAppByIdQuery(variables: GetRemoteAppByIdQueryVariables) {
      return { query: GetRemoteAppByIdDocument, variables: variables }
    }
export const RemoteAppGetUsersDocument = gql`
    query remoteAppGetUsers($where: users_bool_exp!, $limit: Int!, $offset: Int!) {
  users(
    where: $where
    limit: $limit
    offset: $offset
    order_by: {createdAt: desc}
  ) {
    ...RemoteAppGetUsers
  }
  filteredUsersAggreggate: usersAggregate(where: $where) {
    aggregate {
      count
    }
  }
  usersAggregate {
    aggregate {
      count
    }
  }
}
    ${RemoteAppGetUsersFragmentDoc}`;

/**
 * __useRemoteAppGetUsersQuery__
 *
 * To run a query within a React component, call `useRemoteAppGetUsersQuery` and pass it any options that fit your needs.
 * When your component renders, `useRemoteAppGetUsersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRemoteAppGetUsersQuery({
 *   variables: {
 *      where: // value for 'where'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useRemoteAppGetUsersQuery(baseOptions: Apollo.QueryHookOptions<RemoteAppGetUsersQuery, RemoteAppGetUsersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RemoteAppGetUsersQuery, RemoteAppGetUsersQueryVariables>(RemoteAppGetUsersDocument, options);
      }
export function useRemoteAppGetUsersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RemoteAppGetUsersQuery, RemoteAppGetUsersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RemoteAppGetUsersQuery, RemoteAppGetUsersQueryVariables>(RemoteAppGetUsersDocument, options);
        }
export type RemoteAppGetUsersQueryHookResult = ReturnType<typeof useRemoteAppGetUsersQuery>;
export type RemoteAppGetUsersLazyQueryHookResult = ReturnType<typeof useRemoteAppGetUsersLazyQuery>;
export type RemoteAppGetUsersQueryResult = Apollo.QueryResult<RemoteAppGetUsersQuery, RemoteAppGetUsersQueryVariables>;
export function refetchRemoteAppGetUsersQuery(variables: RemoteAppGetUsersQueryVariables) {
      return { query: RemoteAppGetUsersDocument, variables: variables }
    }
export const RemoteAppGetUsersCustomDocument = gql`
    query remoteAppGetUsersCustom($where: users_bool_exp!, $limit: Int!, $offset: Int!) {
  users(
    where: $where
    limit: $limit
    offset: $offset
    order_by: {createdAt: desc}
  ) {
    id
    createdAt
    displayName
    phoneNumber
    avatarUrl
    email
    disabled
    defaultRole
    roles(order_by: {role: asc}) {
      role
    }
    isAnonymous
  }
}
    `;

/**
 * __useRemoteAppGetUsersCustomQuery__
 *
 * To run a query within a React component, call `useRemoteAppGetUsersCustomQuery` and pass it any options that fit your needs.
 * When your component renders, `useRemoteAppGetUsersCustomQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRemoteAppGetUsersCustomQuery({
 *   variables: {
 *      where: // value for 'where'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useRemoteAppGetUsersCustomQuery(baseOptions: Apollo.QueryHookOptions<RemoteAppGetUsersCustomQuery, RemoteAppGetUsersCustomQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RemoteAppGetUsersCustomQuery, RemoteAppGetUsersCustomQueryVariables>(RemoteAppGetUsersCustomDocument, options);
      }
export function useRemoteAppGetUsersCustomLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RemoteAppGetUsersCustomQuery, RemoteAppGetUsersCustomQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RemoteAppGetUsersCustomQuery, RemoteAppGetUsersCustomQueryVariables>(RemoteAppGetUsersCustomDocument, options);
        }
export type RemoteAppGetUsersCustomQueryHookResult = ReturnType<typeof useRemoteAppGetUsersCustomQuery>;
export type RemoteAppGetUsersCustomLazyQueryHookResult = ReturnType<typeof useRemoteAppGetUsersCustomLazyQuery>;
export type RemoteAppGetUsersCustomQueryResult = Apollo.QueryResult<RemoteAppGetUsersCustomQuery, RemoteAppGetUsersCustomQueryVariables>;
export function refetchRemoteAppGetUsersCustomQuery(variables: RemoteAppGetUsersCustomQueryVariables) {
      return { query: RemoteAppGetUsersCustomDocument, variables: variables }
    }
export const RemoteAppGetUsersWholeDocument = gql`
    query remoteAppGetUsersWhole($limit: Int!, $offset: Int!) {
  users(limit: $limit, offset: $offset) {
    ...RemoteAppGetUsers
  }
  usersAggregate {
    aggregate {
      count
    }
  }
}
    ${RemoteAppGetUsersFragmentDoc}`;

/**
 * __useRemoteAppGetUsersWholeQuery__
 *
 * To run a query within a React component, call `useRemoteAppGetUsersWholeQuery` and pass it any options that fit your needs.
 * When your component renders, `useRemoteAppGetUsersWholeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRemoteAppGetUsersWholeQuery({
 *   variables: {
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useRemoteAppGetUsersWholeQuery(baseOptions: Apollo.QueryHookOptions<RemoteAppGetUsersWholeQuery, RemoteAppGetUsersWholeQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RemoteAppGetUsersWholeQuery, RemoteAppGetUsersWholeQueryVariables>(RemoteAppGetUsersWholeDocument, options);
      }
export function useRemoteAppGetUsersWholeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RemoteAppGetUsersWholeQuery, RemoteAppGetUsersWholeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RemoteAppGetUsersWholeQuery, RemoteAppGetUsersWholeQueryVariables>(RemoteAppGetUsersWholeDocument, options);
        }
export type RemoteAppGetUsersWholeQueryHookResult = ReturnType<typeof useRemoteAppGetUsersWholeQuery>;
export type RemoteAppGetUsersWholeLazyQueryHookResult = ReturnType<typeof useRemoteAppGetUsersWholeLazyQuery>;
export type RemoteAppGetUsersWholeQueryResult = Apollo.QueryResult<RemoteAppGetUsersWholeQuery, RemoteAppGetUsersWholeQueryVariables>;
export function refetchRemoteAppGetUsersWholeQuery(variables: RemoteAppGetUsersWholeQueryVariables) {
      return { query: RemoteAppGetUsersWholeDocument, variables: variables }
    }
export const TotalUsersDocument = gql`
    query totalUsers {
  usersAggregate {
    aggregate {
      count
    }
  }
}
    `;

/**
 * __useTotalUsersQuery__
 *
 * To run a query within a React component, call `useTotalUsersQuery` and pass it any options that fit your needs.
 * When your component renders, `useTotalUsersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTotalUsersQuery({
 *   variables: {
 *   },
 * });
 */
export function useTotalUsersQuery(baseOptions?: Apollo.QueryHookOptions<TotalUsersQuery, TotalUsersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TotalUsersQuery, TotalUsersQueryVariables>(TotalUsersDocument, options);
      }
export function useTotalUsersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TotalUsersQuery, TotalUsersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TotalUsersQuery, TotalUsersQueryVariables>(TotalUsersDocument, options);
        }
export type TotalUsersQueryHookResult = ReturnType<typeof useTotalUsersQuery>;
export type TotalUsersLazyQueryHookResult = ReturnType<typeof useTotalUsersLazyQuery>;
export type TotalUsersQueryResult = Apollo.QueryResult<TotalUsersQuery, TotalUsersQueryVariables>;
export function refetchTotalUsersQuery(variables?: TotalUsersQueryVariables) {
      return { query: TotalUsersDocument, variables: variables }
    }
export const TotalUsersByDateDocument = gql`
    query totalUsersByDate($where: users_bool_exp!) {
  usersAggregate(where: $where) {
    aggregate {
      count
    }
  }
}
    `;

/**
 * __useTotalUsersByDateQuery__
 *
 * To run a query within a React component, call `useTotalUsersByDateQuery` and pass it any options that fit your needs.
 * When your component renders, `useTotalUsersByDateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTotalUsersByDateQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useTotalUsersByDateQuery(baseOptions: Apollo.QueryHookOptions<TotalUsersByDateQuery, TotalUsersByDateQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TotalUsersByDateQuery, TotalUsersByDateQueryVariables>(TotalUsersByDateDocument, options);
      }
export function useTotalUsersByDateLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TotalUsersByDateQuery, TotalUsersByDateQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TotalUsersByDateQuery, TotalUsersByDateQueryVariables>(TotalUsersByDateDocument, options);
        }
export type TotalUsersByDateQueryHookResult = ReturnType<typeof useTotalUsersByDateQuery>;
export type TotalUsersByDateLazyQueryHookResult = ReturnType<typeof useTotalUsersByDateLazyQuery>;
export type TotalUsersByDateQueryResult = Apollo.QueryResult<TotalUsersByDateQuery, TotalUsersByDateQueryVariables>;
export function refetchTotalUsersByDateQuery(variables: TotalUsersByDateQueryVariables) {
      return { query: TotalUsersByDateDocument, variables: variables }
    }
export const RestoreDatabaseBackupDocument = gql`
    mutation restoreDatabaseBackup($appId: uuid!, $backupId: uuid!) {
  restoreDatabaseBackup(appId: $appId, backupId: $backupId)
}
    `;
export type RestoreDatabaseBackupMutationFn = Apollo.MutationFunction<RestoreDatabaseBackupMutation, RestoreDatabaseBackupMutationVariables>;

/**
 * __useRestoreDatabaseBackupMutation__
 *
 * To run a mutation, you first call `useRestoreDatabaseBackupMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestoreDatabaseBackupMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restoreDatabaseBackupMutation, { data, loading, error }] = useRestoreDatabaseBackupMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      backupId: // value for 'backupId'
 *   },
 * });
 */
export function useRestoreDatabaseBackupMutation(baseOptions?: Apollo.MutationHookOptions<RestoreDatabaseBackupMutation, RestoreDatabaseBackupMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RestoreDatabaseBackupMutation, RestoreDatabaseBackupMutationVariables>(RestoreDatabaseBackupDocument, options);
      }
export type RestoreDatabaseBackupMutationHookResult = ReturnType<typeof useRestoreDatabaseBackupMutation>;
export type RestoreDatabaseBackupMutationResult = Apollo.MutationResult<RestoreDatabaseBackupMutation>;
export type RestoreDatabaseBackupMutationOptions = Apollo.BaseMutationOptions<RestoreDatabaseBackupMutation, RestoreDatabaseBackupMutationVariables>;
export const ScheduleRestoreDatabaseBackupDocument = gql`
    mutation scheduleRestoreDatabaseBackup($appId: uuid!, $backupId: uuid!) {
  scheduleRestoreDatabaseBackup(appId: $appId, backupId: $backupId)
}
    `;
export type ScheduleRestoreDatabaseBackupMutationFn = Apollo.MutationFunction<ScheduleRestoreDatabaseBackupMutation, ScheduleRestoreDatabaseBackupMutationVariables>;

/**
 * __useScheduleRestoreDatabaseBackupMutation__
 *
 * To run a mutation, you first call `useScheduleRestoreDatabaseBackupMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useScheduleRestoreDatabaseBackupMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [scheduleRestoreDatabaseBackupMutation, { data, loading, error }] = useScheduleRestoreDatabaseBackupMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      backupId: // value for 'backupId'
 *   },
 * });
 */
export function useScheduleRestoreDatabaseBackupMutation(baseOptions?: Apollo.MutationHookOptions<ScheduleRestoreDatabaseBackupMutation, ScheduleRestoreDatabaseBackupMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ScheduleRestoreDatabaseBackupMutation, ScheduleRestoreDatabaseBackupMutationVariables>(ScheduleRestoreDatabaseBackupDocument, options);
      }
export type ScheduleRestoreDatabaseBackupMutationHookResult = ReturnType<typeof useScheduleRestoreDatabaseBackupMutation>;
export type ScheduleRestoreDatabaseBackupMutationResult = Apollo.MutationResult<ScheduleRestoreDatabaseBackupMutation>;
export type ScheduleRestoreDatabaseBackupMutationOptions = Apollo.BaseMutationOptions<ScheduleRestoreDatabaseBackupMutation, ScheduleRestoreDatabaseBackupMutationVariables>;
export const UpdateRemoteAppUserDocument = gql`
    mutation updateRemoteAppUser($id: uuid!, $user: users_set_input!) {
  updateUser(pk_columns: {id: $id}, _set: $user) {
    id
  }
}
    `;
export type UpdateRemoteAppUserMutationFn = Apollo.MutationFunction<UpdateRemoteAppUserMutation, UpdateRemoteAppUserMutationVariables>;

/**
 * __useUpdateRemoteAppUserMutation__
 *
 * To run a mutation, you first call `useUpdateRemoteAppUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRemoteAppUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRemoteAppUserMutation, { data, loading, error }] = useUpdateRemoteAppUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *      user: // value for 'user'
 *   },
 * });
 */
export function useUpdateRemoteAppUserMutation(baseOptions?: Apollo.MutationHookOptions<UpdateRemoteAppUserMutation, UpdateRemoteAppUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateRemoteAppUserMutation, UpdateRemoteAppUserMutationVariables>(UpdateRemoteAppUserDocument, options);
      }
export type UpdateRemoteAppUserMutationHookResult = ReturnType<typeof useUpdateRemoteAppUserMutation>;
export type UpdateRemoteAppUserMutationResult = Apollo.MutationResult<UpdateRemoteAppUserMutation>;
export type UpdateRemoteAppUserMutationOptions = Apollo.BaseMutationOptions<UpdateRemoteAppUserMutation, UpdateRemoteAppUserMutationVariables>;
export const InsertRemoteAppUserRolesDocument = gql`
    mutation insertRemoteAppUserRoles($roles: [authUserRoles_insert_input!]!) {
  insertAuthUserRoles(objects: $roles) {
    affected_rows
  }
}
    `;
export type InsertRemoteAppUserRolesMutationFn = Apollo.MutationFunction<InsertRemoteAppUserRolesMutation, InsertRemoteAppUserRolesMutationVariables>;

/**
 * __useInsertRemoteAppUserRolesMutation__
 *
 * To run a mutation, you first call `useInsertRemoteAppUserRolesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertRemoteAppUserRolesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertRemoteAppUserRolesMutation, { data, loading, error }] = useInsertRemoteAppUserRolesMutation({
 *   variables: {
 *      roles: // value for 'roles'
 *   },
 * });
 */
export function useInsertRemoteAppUserRolesMutation(baseOptions?: Apollo.MutationHookOptions<InsertRemoteAppUserRolesMutation, InsertRemoteAppUserRolesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertRemoteAppUserRolesMutation, InsertRemoteAppUserRolesMutationVariables>(InsertRemoteAppUserRolesDocument, options);
      }
export type InsertRemoteAppUserRolesMutationHookResult = ReturnType<typeof useInsertRemoteAppUserRolesMutation>;
export type InsertRemoteAppUserRolesMutationResult = Apollo.MutationResult<InsertRemoteAppUserRolesMutation>;
export type InsertRemoteAppUserRolesMutationOptions = Apollo.BaseMutationOptions<InsertRemoteAppUserRolesMutation, InsertRemoteAppUserRolesMutationVariables>;
export const DeleteRemoteAppUserRolesDocument = gql`
    mutation deleteRemoteAppUserRoles($userId: uuid!, $roles: [String!]!) {
  deleteAuthUserRoles(
    where: {_and: [{userId: {_eq: $userId}}, {role: {_in: $roles}}]}
  ) {
    affected_rows
  }
}
    `;
export type DeleteRemoteAppUserRolesMutationFn = Apollo.MutationFunction<DeleteRemoteAppUserRolesMutation, DeleteRemoteAppUserRolesMutationVariables>;

/**
 * __useDeleteRemoteAppUserRolesMutation__
 *
 * To run a mutation, you first call `useDeleteRemoteAppUserRolesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRemoteAppUserRolesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRemoteAppUserRolesMutation, { data, loading, error }] = useDeleteRemoteAppUserRolesMutation({
 *   variables: {
 *      userId: // value for 'userId'
 *      roles: // value for 'roles'
 *   },
 * });
 */
export function useDeleteRemoteAppUserRolesMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRemoteAppUserRolesMutation, DeleteRemoteAppUserRolesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRemoteAppUserRolesMutation, DeleteRemoteAppUserRolesMutationVariables>(DeleteRemoteAppUserRolesDocument, options);
      }
export type DeleteRemoteAppUserRolesMutationHookResult = ReturnType<typeof useDeleteRemoteAppUserRolesMutation>;
export type DeleteRemoteAppUserRolesMutationResult = Apollo.MutationResult<DeleteRemoteAppUserRolesMutation>;
export type DeleteRemoteAppUserRolesMutationOptions = Apollo.BaseMutationOptions<DeleteRemoteAppUserRolesMutation, DeleteRemoteAppUserRolesMutationVariables>;
export const ConfirmProvidersUpdatedDocument = gql`
    mutation confirmProvidersUpdated($id: uuid!) {
  updateApp(pk_columns: {id: $id}, _set: {providersUpdated: true}) {
    id
  }
}
    `;
export type ConfirmProvidersUpdatedMutationFn = Apollo.MutationFunction<ConfirmProvidersUpdatedMutation, ConfirmProvidersUpdatedMutationVariables>;

/**
 * __useConfirmProvidersUpdatedMutation__
 *
 * To run a mutation, you first call `useConfirmProvidersUpdatedMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmProvidersUpdatedMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmProvidersUpdatedMutation, { data, loading, error }] = useConfirmProvidersUpdatedMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useConfirmProvidersUpdatedMutation(baseOptions?: Apollo.MutationHookOptions<ConfirmProvidersUpdatedMutation, ConfirmProvidersUpdatedMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ConfirmProvidersUpdatedMutation, ConfirmProvidersUpdatedMutationVariables>(ConfirmProvidersUpdatedDocument, options);
      }
export type ConfirmProvidersUpdatedMutationHookResult = ReturnType<typeof useConfirmProvidersUpdatedMutation>;
export type ConfirmProvidersUpdatedMutationResult = Apollo.MutationResult<ConfirmProvidersUpdatedMutation>;
export type ConfirmProvidersUpdatedMutationOptions = Apollo.BaseMutationOptions<ConfirmProvidersUpdatedMutation, ConfirmProvidersUpdatedMutationVariables>;
export const GetDatabaseConnectionInfoDocument = gql`
    query getDatabaseConnectionInfo($id: uuid!) {
  app(id: $id) {
    id
    postgresUser
    postgresDatabase
  }
}
    `;

/**
 * __useGetDatabaseConnectionInfoQuery__
 *
 * To run a query within a React component, call `useGetDatabaseConnectionInfoQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDatabaseConnectionInfoQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDatabaseConnectionInfoQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetDatabaseConnectionInfoQuery(baseOptions: Apollo.QueryHookOptions<GetDatabaseConnectionInfoQuery, GetDatabaseConnectionInfoQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetDatabaseConnectionInfoQuery, GetDatabaseConnectionInfoQueryVariables>(GetDatabaseConnectionInfoDocument, options);
      }
export function useGetDatabaseConnectionInfoLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetDatabaseConnectionInfoQuery, GetDatabaseConnectionInfoQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetDatabaseConnectionInfoQuery, GetDatabaseConnectionInfoQueryVariables>(GetDatabaseConnectionInfoDocument, options);
        }
export type GetDatabaseConnectionInfoQueryHookResult = ReturnType<typeof useGetDatabaseConnectionInfoQuery>;
export type GetDatabaseConnectionInfoLazyQueryHookResult = ReturnType<typeof useGetDatabaseConnectionInfoLazyQuery>;
export type GetDatabaseConnectionInfoQueryResult = Apollo.QueryResult<GetDatabaseConnectionInfoQuery, GetDatabaseConnectionInfoQueryVariables>;
export function refetchGetDatabaseConnectionInfoQuery(variables: GetDatabaseConnectionInfoQueryVariables) {
      return { query: GetDatabaseConnectionInfoDocument, variables: variables }
    }
export const SignInMethodsDocument = gql`
    query signInMethods($id: uuid!) {
  app(id: $id) {
    id
    slug
    subdomain
    authEmailPasswordlessEnabled
    authEmailSigninEmailVerifiedRequired
    authAnonymousUsersEnabled
    authWebAuthnEnabled
    authSmsPasswordlessEnabled
    authSmsTwilioAccountSid
    authSmsTwilioAuthToken
    authSmsTwilioMessagingServiceId
    authSmsTwilioFrom
    authPasswordHibpEnabled
    authGithubEnabled
    authGithubClientId
    authGithubClientSecret
    authGoogleEnabled
    authGoogleClientId
    authGoogleClientSecret
    authFacebookEnabled
    authFacebookClientId
    authFacebookClientSecret
    authLinkedinEnabled
    authLinkedinClientId
    authLinkedinClientSecret
    authDiscordEnabled
    authDiscordClientId
    authDiscordClientSecret
    authTwitchEnabled
    authTwitchClientId
    authTwitchClientSecret
    authTwitterEnabled
    authTwitterConsumerKey
    authTwitterConsumerSecret
    authAppleEnabled
    authAppleTeamId
    authAppleKeyId
    authAppleClientId
    authApplePrivateKey
    authAppleScope
    authWindowsLiveEnabled
    authWindowsLiveClientId
    authWindowsLiveClientSecret
    authSpotifyEnabled
    authSpotifyClientId
    authSpotifyClientSecret
    authWorkOsEnabled
    authWorkOsClientId
    authWorkOsClientSecret
    authWorkOsDefaultDomain
    authWorkOsDefaultOrganization
    authWorkOsDefaultConnection
  }
}
    `;

/**
 * __useSignInMethodsQuery__
 *
 * To run a query within a React component, call `useSignInMethodsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSignInMethodsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSignInMethodsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSignInMethodsQuery(baseOptions: Apollo.QueryHookOptions<SignInMethodsQuery, SignInMethodsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SignInMethodsQuery, SignInMethodsQueryVariables>(SignInMethodsDocument, options);
      }
export function useSignInMethodsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SignInMethodsQuery, SignInMethodsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SignInMethodsQuery, SignInMethodsQueryVariables>(SignInMethodsDocument, options);
        }
export type SignInMethodsQueryHookResult = ReturnType<typeof useSignInMethodsQuery>;
export type SignInMethodsLazyQueryHookResult = ReturnType<typeof useSignInMethodsLazyQuery>;
export type SignInMethodsQueryResult = Apollo.QueryResult<SignInMethodsQuery, SignInMethodsQueryVariables>;
export function refetchSignInMethodsQuery(variables: SignInMethodsQueryVariables) {
      return { query: SignInMethodsDocument, variables: variables }
    }
export const GetAllUserDataDocument = gql`
    query getAllUserData {
  workspaceMembers {
    id
    workspace {
      id
      name
      creatorUserId
      apps {
        id
        name
        hasuraGraphqlAdminSecret
        subdomain
      }
    }
  }
}
    `;

/**
 * __useGetAllUserDataQuery__
 *
 * To run a query within a React component, call `useGetAllUserDataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllUserDataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllUserDataQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllUserDataQuery(baseOptions?: Apollo.QueryHookOptions<GetAllUserDataQuery, GetAllUserDataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllUserDataQuery, GetAllUserDataQueryVariables>(GetAllUserDataDocument, options);
      }
export function useGetAllUserDataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllUserDataQuery, GetAllUserDataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllUserDataQuery, GetAllUserDataQueryVariables>(GetAllUserDataDocument, options);
        }
export type GetAllUserDataQueryHookResult = ReturnType<typeof useGetAllUserDataQuery>;
export type GetAllUserDataLazyQueryHookResult = ReturnType<typeof useGetAllUserDataLazyQuery>;
export type GetAllUserDataQueryResult = Apollo.QueryResult<GetAllUserDataQuery, GetAllUserDataQueryVariables>;
export function refetchGetAllUserDataQuery(variables?: GetAllUserDataQueryVariables) {
      return { query: GetAllUserDataDocument, variables: variables }
    }
export const GetAvatarDocument = gql`
    query GetAvatar($userId: uuid!) {
  user(id: $userId) {
    id
    avatarUrl
  }
}
    `;

/**
 * __useGetAvatarQuery__
 *
 * To run a query within a React component, call `useGetAvatarQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAvatarQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAvatarQuery({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useGetAvatarQuery(baseOptions: Apollo.QueryHookOptions<GetAvatarQuery, GetAvatarQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAvatarQuery, GetAvatarQueryVariables>(GetAvatarDocument, options);
      }
export function useGetAvatarLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAvatarQuery, GetAvatarQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAvatarQuery, GetAvatarQueryVariables>(GetAvatarDocument, options);
        }
export type GetAvatarQueryHookResult = ReturnType<typeof useGetAvatarQuery>;
export type GetAvatarLazyQueryHookResult = ReturnType<typeof useGetAvatarLazyQuery>;
export type GetAvatarQueryResult = Apollo.QueryResult<GetAvatarQuery, GetAvatarQueryVariables>;
export function refetchGetAvatarQuery(variables: GetAvatarQueryVariables) {
      return { query: GetAvatarDocument, variables: variables }
    }
export const GetOneUserDocument = gql`
    query getOneUser($userId: uuid!) {
  user(id: $userId) {
    id
    displayName
    avatarUrl
    workspaceMembers {
      id
      userId
      workspaceId
      type
      workspace {
        creatorUserId
        id
        slug
        name
        apps {
          id
          slug
          name
          hasuraGraphqlAdminSecret
          repositoryProductionBranch
          subdomain
          isProvisioned
          createdAt
          desiredState
          nhostBaseFolder
          providersUpdated
          featureFlags {
            description
            id
            name
            value
          }
          appStates(order_by: {createdAt: desc}, limit: 1) {
            id
            appId
            message
            stateId
            createdAt
          }
          region {
            id
            countryCode
            awsName
            city
          }
          plan {
            id
            name
            isFree
          }
          githubRepository {
            fullName
          }
          deployments(limit: 4, order_by: {deploymentEndedAt: desc}) {
            id
            commitSHA
            commitMessage
            commitUserName
            deploymentStartedAt
            deploymentEndedAt
            commitUserAvatarUrl
            deploymentStatus
          }
        }
      }
    }
  }
}
    `;

/**
 * __useGetOneUserQuery__
 *
 * To run a query within a React component, call `useGetOneUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetOneUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetOneUserQuery({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useGetOneUserQuery(baseOptions: Apollo.QueryHookOptions<GetOneUserQuery, GetOneUserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetOneUserQuery, GetOneUserQueryVariables>(GetOneUserDocument, options);
      }
export function useGetOneUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetOneUserQuery, GetOneUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetOneUserQuery, GetOneUserQueryVariables>(GetOneUserDocument, options);
        }
export type GetOneUserQueryHookResult = ReturnType<typeof useGetOneUserQuery>;
export type GetOneUserLazyQueryHookResult = ReturnType<typeof useGetOneUserLazyQuery>;
export type GetOneUserQueryResult = Apollo.QueryResult<GetOneUserQuery, GetOneUserQueryVariables>;
export function refetchGetOneUserQuery(variables: GetOneUserQueryVariables) {
      return { query: GetOneUserDocument, variables: variables }
    }
export const GetUserAllWorkspacesDocument = gql`
    query getUserAllWorkspaces {
  workspaceMembers {
    id
    userId
    workspace {
      id
      name
      slug
      apps {
        id
        name
        plan {
          id
          name
        }
        slug
      }
    }
  }
}
    `;

/**
 * __useGetUserAllWorkspacesQuery__
 *
 * To run a query within a React component, call `useGetUserAllWorkspacesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserAllWorkspacesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserAllWorkspacesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUserAllWorkspacesQuery(baseOptions?: Apollo.QueryHookOptions<GetUserAllWorkspacesQuery, GetUserAllWorkspacesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUserAllWorkspacesQuery, GetUserAllWorkspacesQueryVariables>(GetUserAllWorkspacesDocument, options);
      }
export function useGetUserAllWorkspacesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUserAllWorkspacesQuery, GetUserAllWorkspacesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUserAllWorkspacesQuery, GetUserAllWorkspacesQueryVariables>(GetUserAllWorkspacesDocument, options);
        }
export type GetUserAllWorkspacesQueryHookResult = ReturnType<typeof useGetUserAllWorkspacesQuery>;
export type GetUserAllWorkspacesLazyQueryHookResult = ReturnType<typeof useGetUserAllWorkspacesLazyQuery>;
export type GetUserAllWorkspacesQueryResult = Apollo.QueryResult<GetUserAllWorkspacesQuery, GetUserAllWorkspacesQueryVariables>;
export function refetchGetUserAllWorkspacesQuery(variables?: GetUserAllWorkspacesQueryVariables) {
      return { query: GetUserAllWorkspacesDocument, variables: variables }
    }
export const InsertFeedbackOneDocument = gql`
    mutation insertFeedbackOne($feedback: feedback_insert_input!) {
  insertFeedbackOne(object: $feedback) {
    id
  }
}
    `;
export type InsertFeedbackOneMutationFn = Apollo.MutationFunction<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>;

/**
 * __useInsertFeedbackOneMutation__
 *
 * To run a mutation, you first call `useInsertFeedbackOneMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertFeedbackOneMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertFeedbackOneMutation, { data, loading, error }] = useInsertFeedbackOneMutation({
 *   variables: {
 *      feedback: // value for 'feedback'
 *   },
 * });
 */
export function useInsertFeedbackOneMutation(baseOptions?: Apollo.MutationHookOptions<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>(InsertFeedbackOneDocument, options);
      }
export type InsertFeedbackOneMutationHookResult = ReturnType<typeof useInsertFeedbackOneMutation>;
export type InsertFeedbackOneMutationResult = Apollo.MutationResult<InsertFeedbackOneMutation>;
export type InsertFeedbackOneMutationOptions = Apollo.BaseMutationOptions<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>;
export const DeleteWorkspaceMemberInvitesDocument = gql`
    mutation deleteWorkspaceMemberInvites($id: uuid!) {
  deleteWorkspaceMemberInvites(where: {id: {_eq: $id}}) {
    affected_rows
  }
}
    `;
export type DeleteWorkspaceMemberInvitesMutationFn = Apollo.MutationFunction<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>;

/**
 * __useDeleteWorkspaceMemberInvitesMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMemberInvitesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMemberInvitesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMemberInvitesMutation, { data, loading, error }] = useDeleteWorkspaceMemberInvitesMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMemberInvitesMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>(DeleteWorkspaceMemberInvitesDocument, options);
      }
export type DeleteWorkspaceMemberInvitesMutationHookResult = ReturnType<typeof useDeleteWorkspaceMemberInvitesMutation>;
export type DeleteWorkspaceMemberInvitesMutationResult = Apollo.MutationResult<DeleteWorkspaceMemberInvitesMutation>;
export type DeleteWorkspaceMemberInvitesMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>;
export const GetWorkspaceMemberInvitesToManageDocument = gql`
    query getWorkspaceMemberInvitesToManage($userId: uuid!) {
  workspaceMemberInvites(where: {userByEmail: {id: {_eq: $userId}}}) {
    id
    email
    userByEmail {
      id
    }
    workspace {
      id
      name
      slug
    }
  }
}
    `;

/**
 * __useGetWorkspaceMemberInvitesToManageQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceMemberInvitesToManageQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceMemberInvitesToManageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceMemberInvitesToManageQuery({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useGetWorkspaceMemberInvitesToManageQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>(GetWorkspaceMemberInvitesToManageDocument, options);
      }
export function useGetWorkspaceMemberInvitesToManageLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>(GetWorkspaceMemberInvitesToManageDocument, options);
        }
export type GetWorkspaceMemberInvitesToManageQueryHookResult = ReturnType<typeof useGetWorkspaceMemberInvitesToManageQuery>;
export type GetWorkspaceMemberInvitesToManageLazyQueryHookResult = ReturnType<typeof useGetWorkspaceMemberInvitesToManageLazyQuery>;
export type GetWorkspaceMemberInvitesToManageQueryResult = Apollo.QueryResult<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>;
export function refetchGetWorkspaceMemberInvitesToManageQuery(variables: GetWorkspaceMemberInvitesToManageQueryVariables) {
      return { query: GetWorkspaceMemberInvitesToManageDocument, variables: variables }
    }
export const InsertWorkspaceMemberInviteDocument = gql`
    mutation insertWorkspaceMemberInvite($workspaceMemberInvite: workspaceMemberInvites_insert_input!) {
  insertWorkspaceMemberInvite(object: $workspaceMemberInvite) {
    id
  }
}
    `;
export type InsertWorkspaceMemberInviteMutationFn = Apollo.MutationFunction<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>;

/**
 * __useInsertWorkspaceMemberInviteMutation__
 *
 * To run a mutation, you first call `useInsertWorkspaceMemberInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertWorkspaceMemberInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertWorkspaceMemberInviteMutation, { data, loading, error }] = useInsertWorkspaceMemberInviteMutation({
 *   variables: {
 *      workspaceMemberInvite: // value for 'workspaceMemberInvite'
 *   },
 * });
 */
export function useInsertWorkspaceMemberInviteMutation(baseOptions?: Apollo.MutationHookOptions<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>(InsertWorkspaceMemberInviteDocument, options);
      }
export type InsertWorkspaceMemberInviteMutationHookResult = ReturnType<typeof useInsertWorkspaceMemberInviteMutation>;
export type InsertWorkspaceMemberInviteMutationResult = Apollo.MutationResult<InsertWorkspaceMemberInviteMutation>;
export type InsertWorkspaceMemberInviteMutationOptions = Apollo.BaseMutationOptions<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>;
export const UpdateWorkspaceMemberInviteDocument = gql`
    mutation updateWorkspaceMemberInvite($id: uuid!, $workspaceMemberInvite: workspaceMemberInvites_set_input!) {
  updateWorkspaceMemberInvites(
    _set: $workspaceMemberInvite
    where: {id: {_eq: $id}}
  ) {
    affected_rows
  }
}
    `;
export type UpdateWorkspaceMemberInviteMutationFn = Apollo.MutationFunction<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>;

/**
 * __useUpdateWorkspaceMemberInviteMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMemberInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMemberInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMemberInviteMutation, { data, loading, error }] = useUpdateWorkspaceMemberInviteMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspaceMemberInvite: // value for 'workspaceMemberInvite'
 *   },
 * });
 */
export function useUpdateWorkspaceMemberInviteMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>(UpdateWorkspaceMemberInviteDocument, options);
      }
export type UpdateWorkspaceMemberInviteMutationHookResult = ReturnType<typeof useUpdateWorkspaceMemberInviteMutation>;
export type UpdateWorkspaceMemberInviteMutationResult = Apollo.MutationResult<UpdateWorkspaceMemberInviteMutation>;
export type UpdateWorkspaceMemberInviteMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>;
export const DeleteWorkspaceMemberDocument = gql`
    mutation deleteWorkspaceMember($id: uuid!) {
  deleteWorkspaceMember(id: $id) {
    id
  }
}
    `;
export type DeleteWorkspaceMemberMutationFn = Apollo.MutationFunction<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>;

/**
 * __useDeleteWorkspaceMemberMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMemberMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMemberMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMemberMutation, { data, loading, error }] = useDeleteWorkspaceMemberMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMemberMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>(DeleteWorkspaceMemberDocument, options);
      }
export type DeleteWorkspaceMemberMutationHookResult = ReturnType<typeof useDeleteWorkspaceMemberMutation>;
export type DeleteWorkspaceMemberMutationResult = Apollo.MutationResult<DeleteWorkspaceMemberMutation>;
export type DeleteWorkspaceMemberMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>;
export const GetWorkspaceMembersDocument = gql`
    query getWorkspaceMembers($workspaceId: uuid!) {
  workspace(id: $workspaceId) {
    id
    creatorUser {
      id
    }
    workspaceMembers(order_by: {createdAt: asc}) {
      ...getWorkspaceMembersWorkspaceMember
    }
    workspaceMemberInvites(order_by: {createdAt: asc}) {
      ...getWorkspaceMembersWorkspaceMemberInvite
    }
  }
}
    ${GetWorkspaceMembersWorkspaceMemberFragmentDoc}
${GetWorkspaceMembersWorkspaceMemberInviteFragmentDoc}`;

/**
 * __useGetWorkspaceMembersQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceMembersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceMembersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceMembersQuery({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *   },
 * });
 */
export function useGetWorkspaceMembersQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>(GetWorkspaceMembersDocument, options);
      }
export function useGetWorkspaceMembersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>(GetWorkspaceMembersDocument, options);
        }
export type GetWorkspaceMembersQueryHookResult = ReturnType<typeof useGetWorkspaceMembersQuery>;
export type GetWorkspaceMembersLazyQueryHookResult = ReturnType<typeof useGetWorkspaceMembersLazyQuery>;
export type GetWorkspaceMembersQueryResult = Apollo.QueryResult<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>;
export function refetchGetWorkspaceMembersQuery(variables: GetWorkspaceMembersQueryVariables) {
      return { query: GetWorkspaceMembersDocument, variables: variables }
    }
export const UpdateWorkspaceMemberDocument = gql`
    mutation updateWorkspaceMember($id: uuid!, $workspaceMember: workspaceMembers_set_input!) {
  updateWorkspaceMember(_set: $workspaceMember, pk_columns: {id: $id}) {
    id
  }
}
    `;
export type UpdateWorkspaceMemberMutationFn = Apollo.MutationFunction<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>;

/**
 * __useUpdateWorkspaceMemberMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMemberMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMemberMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMemberMutation, { data, loading, error }] = useUpdateWorkspaceMemberMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspaceMember: // value for 'workspaceMember'
 *   },
 * });
 */
export function useUpdateWorkspaceMemberMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>(UpdateWorkspaceMemberDocument, options);
      }
export type UpdateWorkspaceMemberMutationHookResult = ReturnType<typeof useUpdateWorkspaceMemberMutation>;
export type UpdateWorkspaceMemberMutationResult = Apollo.MutationResult<UpdateWorkspaceMemberMutation>;
export type UpdateWorkspaceMemberMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>;
export const DeleteWorkspaceDocument = gql`
    mutation deleteWorkspace($id: uuid!) {
  deleteWorkspace(id: $id) {
    id
  }
}
    `;
export type DeleteWorkspaceMutationFn = Apollo.MutationFunction<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>;

/**
 * __useDeleteWorkspaceMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMutation, { data, loading, error }] = useDeleteWorkspaceMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>(DeleteWorkspaceDocument, options);
      }
export type DeleteWorkspaceMutationHookResult = ReturnType<typeof useDeleteWorkspaceMutation>;
export type DeleteWorkspaceMutationResult = Apollo.MutationResult<DeleteWorkspaceMutation>;
export type DeleteWorkspaceMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>;
export const GetAppsByWorkspaceDocument = gql`
    query getAppsByWorkspace($workspace_id: uuid!) {
  workspace(id: $workspace_id) {
    id
    name
    slug
    apps {
      name
      plan {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useGetAppsByWorkspaceQuery__
 *
 * To run a query within a React component, call `useGetAppsByWorkspaceQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppsByWorkspaceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppsByWorkspaceQuery({
 *   variables: {
 *      workspace_id: // value for 'workspace_id'
 *   },
 * });
 */
export function useGetAppsByWorkspaceQuery(baseOptions: Apollo.QueryHookOptions<GetAppsByWorkspaceQuery, GetAppsByWorkspaceQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppsByWorkspaceQuery, GetAppsByWorkspaceQueryVariables>(GetAppsByWorkspaceDocument, options);
      }
export function useGetAppsByWorkspaceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppsByWorkspaceQuery, GetAppsByWorkspaceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppsByWorkspaceQuery, GetAppsByWorkspaceQueryVariables>(GetAppsByWorkspaceDocument, options);
        }
export type GetAppsByWorkspaceQueryHookResult = ReturnType<typeof useGetAppsByWorkspaceQuery>;
export type GetAppsByWorkspaceLazyQueryHookResult = ReturnType<typeof useGetAppsByWorkspaceLazyQuery>;
export type GetAppsByWorkspaceQueryResult = Apollo.QueryResult<GetAppsByWorkspaceQuery, GetAppsByWorkspaceQueryVariables>;
export function refetchGetAppsByWorkspaceQuery(variables: GetAppsByWorkspaceQueryVariables) {
      return { query: GetAppsByWorkspaceDocument, variables: variables }
    }
export const GetWorkspaceInvoicesDocument = gql`
    query getWorkspaceInvoices($id: uuid!) {
  workspace(id: $id) {
    id
  }
}
    `;

/**
 * __useGetWorkspaceInvoicesQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceInvoicesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceInvoicesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceInvoicesQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetWorkspaceInvoicesQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceInvoicesQuery, GetWorkspaceInvoicesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceInvoicesQuery, GetWorkspaceInvoicesQueryVariables>(GetWorkspaceInvoicesDocument, options);
      }
export function useGetWorkspaceInvoicesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceInvoicesQuery, GetWorkspaceInvoicesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceInvoicesQuery, GetWorkspaceInvoicesQueryVariables>(GetWorkspaceInvoicesDocument, options);
        }
export type GetWorkspaceInvoicesQueryHookResult = ReturnType<typeof useGetWorkspaceInvoicesQuery>;
export type GetWorkspaceInvoicesLazyQueryHookResult = ReturnType<typeof useGetWorkspaceInvoicesLazyQuery>;
export type GetWorkspaceInvoicesQueryResult = Apollo.QueryResult<GetWorkspaceInvoicesQuery, GetWorkspaceInvoicesQueryVariables>;
export function refetchGetWorkspaceInvoicesQuery(variables: GetWorkspaceInvoicesQueryVariables) {
      return { query: GetWorkspaceInvoicesDocument, variables: variables }
    }
export const GetWorkspaceSettingsDocument = gql`
    query getWorkspaceSettings($id: uuid!) {
  workspace(id: $id) {
    id
    name
    addressLine1
    addressLine2
    addressPostalCode
    addressPostalCode
    addressCity
    addressState
    addressCountryCode
    companyName
    email
  }
}
    `;

/**
 * __useGetWorkspaceSettingsQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceSettingsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetWorkspaceSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceSettingsQuery, GetWorkspaceSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceSettingsQuery, GetWorkspaceSettingsQueryVariables>(GetWorkspaceSettingsDocument, options);
      }
export function useGetWorkspaceSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceSettingsQuery, GetWorkspaceSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceSettingsQuery, GetWorkspaceSettingsQueryVariables>(GetWorkspaceSettingsDocument, options);
        }
export type GetWorkspaceSettingsQueryHookResult = ReturnType<typeof useGetWorkspaceSettingsQuery>;
export type GetWorkspaceSettingsLazyQueryHookResult = ReturnType<typeof useGetWorkspaceSettingsLazyQuery>;
export type GetWorkspaceSettingsQueryResult = Apollo.QueryResult<GetWorkspaceSettingsQuery, GetWorkspaceSettingsQueryVariables>;
export function refetchGetWorkspaceSettingsQuery(variables: GetWorkspaceSettingsQueryVariables) {
      return { query: GetWorkspaceSettingsDocument, variables: variables }
    }
export const GetWorkspaceDocument = gql`
    query getWorkspace($id: uuid!) {
  workspace(id: $id) {
    ...GetWorkspace
  }
}
    ${GetWorkspaceFragmentDoc}`;

/**
 * __useGetWorkspaceQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetWorkspaceQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceQuery, GetWorkspaceQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceQuery, GetWorkspaceQueryVariables>(GetWorkspaceDocument, options);
      }
export function useGetWorkspaceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceQuery, GetWorkspaceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceQuery, GetWorkspaceQueryVariables>(GetWorkspaceDocument, options);
        }
export type GetWorkspaceQueryHookResult = ReturnType<typeof useGetWorkspaceQuery>;
export type GetWorkspaceLazyQueryHookResult = ReturnType<typeof useGetWorkspaceLazyQuery>;
export type GetWorkspaceQueryResult = Apollo.QueryResult<GetWorkspaceQuery, GetWorkspaceQueryVariables>;
export function refetchGetWorkspaceQuery(variables: GetWorkspaceQueryVariables) {
      return { query: GetWorkspaceDocument, variables: variables }
    }
export const GetWorkspaceWhereDocument = gql`
    query getWorkspaceWhere($where: workspaces_bool_exp!) {
  workspaces(where: $where) {
    ...GetWorkspace
  }
}
    ${GetWorkspaceFragmentDoc}`;

/**
 * __useGetWorkspaceWhereQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceWhereQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceWhereQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceWhereQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetWorkspaceWhereQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceWhereQuery, GetWorkspaceWhereQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceWhereQuery, GetWorkspaceWhereQueryVariables>(GetWorkspaceWhereDocument, options);
      }
export function useGetWorkspaceWhereLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceWhereQuery, GetWorkspaceWhereQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceWhereQuery, GetWorkspaceWhereQueryVariables>(GetWorkspaceWhereDocument, options);
        }
export type GetWorkspaceWhereQueryHookResult = ReturnType<typeof useGetWorkspaceWhereQuery>;
export type GetWorkspaceWhereLazyQueryHookResult = ReturnType<typeof useGetWorkspaceWhereLazyQuery>;
export type GetWorkspaceWhereQueryResult = Apollo.QueryResult<GetWorkspaceWhereQuery, GetWorkspaceWhereQueryVariables>;
export function refetchGetWorkspaceWhereQuery(variables: GetWorkspaceWhereQueryVariables) {
      return { query: GetWorkspaceWhereDocument, variables: variables }
    }
export const GetWorkspacesAppsByIdDocument = gql`
    query GetWorkspacesAppsById($workspaceId: uuid!) {
  workspace(id: $workspaceId) {
    id
    slug
    apps {
      id
      name
      slug
      updatedAt
      plan {
        id
        name
      }
    }
  }
}
    `;

/**
 * __useGetWorkspacesAppsByIdQuery__
 *
 * To run a query within a React component, call `useGetWorkspacesAppsByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspacesAppsByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspacesAppsByIdQuery({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *   },
 * });
 */
export function useGetWorkspacesAppsByIdQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspacesAppsByIdQuery, GetWorkspacesAppsByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspacesAppsByIdQuery, GetWorkspacesAppsByIdQueryVariables>(GetWorkspacesAppsByIdDocument, options);
      }
export function useGetWorkspacesAppsByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspacesAppsByIdQuery, GetWorkspacesAppsByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspacesAppsByIdQuery, GetWorkspacesAppsByIdQueryVariables>(GetWorkspacesAppsByIdDocument, options);
        }
export type GetWorkspacesAppsByIdQueryHookResult = ReturnType<typeof useGetWorkspacesAppsByIdQuery>;
export type GetWorkspacesAppsByIdLazyQueryHookResult = ReturnType<typeof useGetWorkspacesAppsByIdLazyQuery>;
export type GetWorkspacesAppsByIdQueryResult = Apollo.QueryResult<GetWorkspacesAppsByIdQuery, GetWorkspacesAppsByIdQueryVariables>;
export function refetchGetWorkspacesAppsByIdQuery(variables: GetWorkspacesAppsByIdQueryVariables) {
      return { query: GetWorkspacesAppsByIdDocument, variables: variables }
    }
export const InsertWorkspaceDocument = gql`
    mutation insertWorkspace($workspace: workspaces_insert_input!) {
  insertWorkspace(object: $workspace) {
    name
    id
  }
}
    `;
export type InsertWorkspaceMutationFn = Apollo.MutationFunction<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>;

/**
 * __useInsertWorkspaceMutation__
 *
 * To run a mutation, you first call `useInsertWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertWorkspaceMutation, { data, loading, error }] = useInsertWorkspaceMutation({
 *   variables: {
 *      workspace: // value for 'workspace'
 *   },
 * });
 */
export function useInsertWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>(InsertWorkspaceDocument, options);
      }
export type InsertWorkspaceMutationHookResult = ReturnType<typeof useInsertWorkspaceMutation>;
export type InsertWorkspaceMutationResult = Apollo.MutationResult<InsertWorkspaceMutation>;
export type InsertWorkspaceMutationOptions = Apollo.BaseMutationOptions<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>;
export const UpdateWorkspaceDocument = gql`
    mutation updateWorkspace($id: uuid!, $workspace: workspaces_set_input!) {
  updateWorkspace(pk_columns: {id: $id}, _set: $workspace) {
    id
    name
    email
    companyName
    addressLine1
    addressLine2
    addressPostalCode
    addressCity
    addressCountryCode
    slug
    taxIdType
    taxIdValue
  }
}
    `;
export type UpdateWorkspaceMutationFn = Apollo.MutationFunction<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;

/**
 * __useUpdateWorkspaceMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMutation, { data, loading, error }] = useUpdateWorkspaceMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspace: // value for 'workspace'
 *   },
 * });
 */
export function useUpdateWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>(UpdateWorkspaceDocument, options);
      }
export type UpdateWorkspaceMutationHookResult = ReturnType<typeof useUpdateWorkspaceMutation>;
export type UpdateWorkspaceMutationResult = Apollo.MutationResult<UpdateWorkspaceMutation>;
export type UpdateWorkspaceMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;
export const GetWorkspacesDocument = gql`
    query getWorkspaces {
  workspaces(order_by: {name: asc}) {
    id
    createdAt
    name
    slug
    creatorUserId
  }
}
    `;

/**
 * __useGetWorkspacesQuery__
 *
 * To run a query within a React component, call `useGetWorkspacesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspacesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspacesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetWorkspacesQuery(baseOptions?: Apollo.QueryHookOptions<GetWorkspacesQuery, GetWorkspacesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspacesQuery, GetWorkspacesQueryVariables>(GetWorkspacesDocument, options);
      }
export function useGetWorkspacesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspacesQuery, GetWorkspacesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspacesQuery, GetWorkspacesQueryVariables>(GetWorkspacesDocument, options);
        }
export type GetWorkspacesQueryHookResult = ReturnType<typeof useGetWorkspacesQuery>;
export type GetWorkspacesLazyQueryHookResult = ReturnType<typeof useGetWorkspacesLazyQuery>;
export type GetWorkspacesQueryResult = Apollo.QueryResult<GetWorkspacesQuery, GetWorkspacesQueryVariables>;
export function refetchGetWorkspacesQuery(variables?: GetWorkspacesQueryVariables) {
      return { query: GetWorkspacesDocument, variables: variables }
    }