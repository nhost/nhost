import type {
  Cell,
  CellContext,
  Column,
  ColumnDef,
  Row,
} from '@tanstack/react-table';
import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';

/**
 * Base options for functions that is used by data browser mutations or queries.
 */
export interface MutationOrQueryBaseOptions {
  /**
   * Custom data source.
   */
  dataSource: string;
  /**
   * Custom schema.
   */
  schema: string;
  /**
   * Custom table.
   */
  table: string;
  /**
   * Custom app URL.
   */
  appUrl: string;
  /**
   * Custom admin secret.
   */
  adminSecret: string;
}

/**
 * Represents a relationship from Hasura metadata.
 */
export interface HasuraMetadataRelationship {
  name: string;
  using: {
    manual_configuration?: {
      column_mapping: Record<string, string>;
      remote_table: {
        name: string;
        schema: string;
      };
    };
    foreign_key_constraint_on?:
      | string
      | {
          column: string;
          table: {
            name: string;
            schema: string;
          };
        };
  };
}

export interface HasuraMetadataPermission {
  role: string;
  permission: Partial<{
    columns: string[];
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    filter: Record<string, any>;
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    check: Record<string, any>;
    limit: number | null;
    allow_aggregations: boolean;
    query_root_fields: string[] | null;
    subscription_root_fields: string[] | null;
    computed_fields: string[] | null;
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    set: Record<string, any> | null;
    backend_only: boolean;
  }>;
}

/**
 * Represents a table from Hasura metadata.
 */
export interface HasuraMetadataTable {
  table: {
    name: string;
    schema: string;
  };
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  configuration: Record<string, Record<string, any>>;
  array_relationships?: HasuraMetadataRelationship[];
  object_relationships?: HasuraMetadataRelationship[];
  insert_permissions?: HasuraMetadataPermission[];
  select_permissions?: HasuraMetadataPermission[];
  update_permissions?: HasuraMetadataPermission[];
  delete_permissions?: HasuraMetadataPermission[];
}

/**
 * Represents a source from Hasura metadata.
 */
export interface HasuraMetadataSource {
  name: string;
  kind: string;
  tables: HasuraMetadataTable[];
}

/**
 * Represents the metadata from Hasura.
 */
export interface HasuraMetadata {
  version: number;
  sources: HasuraMetadataSource[];
}

/**
 * Represents an SQL query result.
 */
export interface QueryResult<T> {
  result: T;
  result_type: string;
}

/**
 * Represents an SQL DELETE operation's result.
 */
export interface AffectedRowsResult {
  affected_rows: number;
}

/**
 * Represents an error returned by Hasura's schema API.
 */
export interface QueryError {
  code: string;
  error: string;
  path: string;
  message?: string;
  internal?: {
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    arguments: any[];
    prepared: boolean;
    statement: string;
    error: {
      exec_status: string;
      message: string;
      status_code: string;
      hint?: string;
      description?: string;
    };
  };
}

/**
 * Represents an error returned by Hasura's metadata API.
 */
export interface MetadataError {
  code: string;
  error: string;
  path: string;
  internal?: {
    name: string;
    reason: string;
    type: string;
    definition: {
      source: string;
      name: string;
      comment?: string;
    };
    table: {
      schema: string;
      name: string;
    };
    using?: {
      foreign_key_constraint_on: string;
    };
  }[];
}

/**
 * Represents a raw data row returned by the SQL query.
 */
export type RawQueryDataRow = string[];

/**
 * Represents a normalized data row returned by the SQL query.
 */
// biome-ignore lint/suspicious/noExplicitAny: TODO
export type NormalizedQueryDataRow = Record<string, any>;

/**
 * Represents an object that can be used to set up ordering in an SQL query.
 */
export interface OrderBy {
  columnName: string;
  mode:
    | 'ASC'
    | 'DESC'
    | 'ASC NULLS FIRST'
    | 'DESC NULLS FIRST'
    | 'ASC NULLS LAST'
    | 'DESC NULLS LAST';
}

/**
 * Represents an object that can be used to update a column in an SQL query.
 */
export interface ColumnUpdateOptions {
  /**
   * New value for the column.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  value?: any;
  /**
   * Whether to set the column to NULL.
   */
  reset?: boolean;
}

/**
 * Represents an object that can be used to insert a column in an SQL query.
 */
export interface ColumnInsertOptions {
  /**
   * Value for the column.
   */
  value?: unknown;
  /**
   * Fallback value if the column value is `undefined`.
   */
  fallbackValue?: 'NULL' | 'DEFAULT';
}

/**
 * User defined column type of a character field in PostgreSQL.
 */
export type CharacterColumnType =
  | 'bpchar'
  | 'text'
  | `character varying(${number})`
  | 'character varying';

/**
 * User defined column type of a boolean field in PostgreSQL.
 */
export type BooleanColumnType = 'bool';

/**
 * User defined column type of a UUID field in PostgreSQL.
 */
export type UUIDColumnType = 'uuid';

/**
 * User defined column type of a date / time field in PostgreSQL.
 */
export type DateColumnType =
  | 'date'
  | 'timestamp'
  | 'timestamptz'
  | 'time'
  | 'timetz'
  | 'interval';

/**
 * User defined column type of a numeric field in PostgreSQL.
 */
export type NumericColumnType =
  | 'oid'
  | 'numeric'
  | 'int2'
  | 'int4'
  | 'serial'
  | 'int8'
  | 'bigserial'
  | 'float4'
  | 'float8'
  | 'serial2'
  | 'serial4'
  | 'serial8';

/**
 * User defined column type of a JSON field in PostgreSQL.
 */
export type JSONColumnType = 'json' | 'jsonb';

/**
 * User defined column type of a monetary field in PostgreSQL.
 */
export type MonetaryColumnType = 'money';

/**
 * User defined column type of a network address field in PostgreSQL.
 */
export type NetworkAddressType = 'cidr' | 'inet' | 'macaddr' | 'macaddr8';

/**
 * User defined column type of a geometric field in PostgreSQL.
 */
export type GeometricType =
  | 'point'
  | 'line'
  | 'lseg'
  | 'box'
  | 'path'
  | 'polygon'
  | 'circle';

/**
 * User defined column type of a binary field in PostgreSQL.
 */
export type BinaryType = 'bytea';

/**
 * User defined column type of an object identifier field in PostgreSQL.
 */
export type ObjectIdentifierType =
  | 'oid'
  | 'regclass'
  | 'regcollation'
  | 'regconfig'
  | 'regdictionary'
  | 'regnamespace'
  | 'regoper'
  | 'regoperator'
  | 'regproc'
  | 'regprocedure'
  | 'regrole'
  | 'regtype';

/**
 * User defined column type in PostgreSQL.
 */
export type ColumnType =
  | NumericColumnType
  | BooleanColumnType
  | UUIDColumnType
  | CharacterColumnType
  | DateColumnType
  | JSONColumnType
  | MonetaryColumnType
  | NetworkAddressType
  | GeometricType
  | BinaryType
  | ObjectIdentifierType;

/**
 * Represents referential actions in PostgreSQL.
 */
export type PostgresReferentialAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

/**
 * Represents a foreign key in a table.
 */
export interface ForeignKeyRelation {
  id?: string;
  name?: string;
  columnName: string;
  referencedSchema?: string | null;
  referencedTable: string;
  referencedColumn: string;
  updateAction: PostgresReferentialAction;
  deleteAction: PostgresReferentialAction;
  oneToOne?: boolean;
}

/**
 * Represents a column in a table.
 */
export interface DatabaseColumn {
  /**
   * Identifier of the column. This is usually the same as `name` but can be
   * different if the column name is changed by the user, but it has not been
   * saved yet.
   */
  id?: string;
  /**
   * Name of the column.
   */
  name: string;
  /**
   * Type of the column.
   */
  type: AutocompleteOption<ColumnType>;
  /**
   * Default value of the column.
   */
  defaultValue?: string | null | AutocompleteOption<string | null>;
  /**
   * Determines whether or not the column is nullable.
   */
  isNullable?: boolean;
  /**
   * Determines whether or not the column values are unique.
   */
  isUnique?: boolean;
  /**
   * Determines whether or not the column is identity.
   */
  isIdentity?: boolean;
  /**
   * Determines whether or not the column is a primary key of the table.
   */
  isPrimary?: boolean;
  /**
   * Comment of the column.
   */
  comment?: string | null;
  /**
   * Foreign key relation of the column.
   */
  foreignKeyRelation?: ForeignKeyRelation | null;
  /**
   * Name of unique constraints on the column.
   */
  uniqueConstraints?: string[];
  /**
   * Name of primary key constraints on the column.
   */
  primaryConstraints?: string[];
}

/**
 * Represents a database table.
 */
export interface DatabaseTable {
  /**
   * Name of the table.
   */
  name: string;
  /**
   * Columns of the table.
   */
  columns: DatabaseColumn[];
  /**
   * Primary key of the table.
   */
  primaryKey: string[];
  /**
   * Identity column of the table.
   */
  identityColumn?: string;
  /**
   * Foreign key relations of the table.
   */
  foreignKeyRelations?: ForeignKeyRelation[];
}

/**
 * Represents the metadata of a column in the data browser.
 */
export interface DataBrowserColumnMetadata {
  /**
   * Identifier of the column.
   */
  id: string;
  /**
   * Simple type of the column.
   */
  type: 'text' | 'number' | 'boolean' | 'date' | 'uuid';
  /**
   * Specific database type of the column (e.g. `timestamptz`).
   */
  specificType: ColumnType;
  /**
   * Data type of the column (e.g. `timestamp with time zone`).
   */
  dataType: string;
  /**
   * Default value of the column.
   */
  defaultValue?: string;
  /**
   * Determines whether or not the column is a primary key of the table.
   */
  isPrimary?: boolean;
  /**
   * Determines whether or not the column is nullable.
   */
  isNullable?: boolean;
  /**
   * Determines whether or not the column is identity.
   */
  isIdentity?: boolean;
  /**
   * Determines whether or not the column is unique.
   */
  isUnique?: boolean;
  /**
   * Comment of the column.
   */
  comment?: string | null;
  /**
   * Foreign key relation of the column.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  foreignKeyRelation?: any;
  /**
   * Determines whether or not the column is editable.
   */
  isEditable?: boolean;
  /**
   * Determines whether or not the default value is custom.
   */
  isDefaultValueCustom?: boolean;
  /**
   * Name of unique constraints on the column.
   */
  uniqueConstraints?: string[];
  /**
   * Name of primary key constraints on the column.
   */
  primaryConstraints?: string[];
}

/**
 * Represents a column in the data browser.
 */
export type DataBrowserGridColumn<
  TData extends object = {},
  TValue = unknown,
> = Column<TData, TValue>;

/**
 * Represents a column definition in the data browser.
 */
export type DataBrowserGridColumnDef<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
  TValue = unknown,
> = ColumnDef<TData, TValue>;

/**
 * Represents a cell in the data browser.
 */
export interface DataBrowserGridCell<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
  TValue = unknown,
> extends Omit<Cell<TData, TValue>, 'column'> {
  /**
   * Column name.
   */
  column: DataBrowserGridColumn<TData, TValue>;
}

/**
 * Represents a row in the data browser.
 */
export type DataBrowserGridRow<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
> = Row<TData>;

/**
 * Represents the properties of a cell.
 */
export interface DataBrowserGridCellProps<
  TData extends UnknownDataGridRow = UnknownDataGridRow,
  TValue = unknown,
> extends CellContext<TData, TValue> {
  /**
   * Data browser grid column props.
   */
  column: DataBrowserGridColumn<TData, TValue>;
  /**
   * Data browser grid cell props.
   */
  cell: DataBrowserGridCell<TData, TValue>;
  /**
   * Data browser grid row props.
   */
  row: DataBrowserGridRow<TData>;
}

/**
 * Represents an available database action.
 */
export type DatabaseAction = 'insert' | 'select' | 'update' | 'delete';

/**
 * Represents the database access level.
 */
export type DatabaseAccessLevel = 'full' | 'partial' | 'none';

/**
 * Represents a Hasura operator.
 */
export type HasuraOperator =
  | '_eq'
  | '_neq'
  | '_in'
  | '_nin'
  | '_gt'
  | '_lt'
  | '_gte'
  | '_lte'
  | '_like'
  | '_nlike'
  | '_ilike'
  | '_nilike'
  | '_similar'
  | '_nsimilar'
  | '_regex'
  | '_iregex'
  | '_nregex'
  | '_niregex'
  | '_ceq'
  | '_cne'
  | '_cgt'
  | '_clt'
  | '_cgte'
  | '_clte'
  | '_is_null'
  | '_contains'
  | '_contained_in'
  | '_has_key'
  | '_has_keys_any'
  | '_has_keys_all';

/**
 * Represents a rule. A rule is a single condition in a rule group.
 */
export interface Rule {
  column: string;
  operator: HasuraOperator;
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  value: any;
}

/**
 * Represents a rule group. A rule group can contain rules and other rule
 * groups.
 */
export interface RuleGroup {
  operator: '_and' | '_or';
  rules: Rule[];
  groups: RuleGroup[];
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  unsupported?: Record<string, any>[];
}
