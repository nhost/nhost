import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import type { Cell, CellProps, ColumnInstance, Row } from 'react-table';

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
    filter: Record<string, any>;
    check: Record<string, any>;
    limit: number;
    allow_aggregations: boolean;
    query_root_fields: string[];
    subscription_root_fields: string[];
    computed_fields: string[];
    set: Record<string, any>;
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
  value?: any;
  /**
   * Fallback value if the column value is `undefined`.
   */
  fallbackValue?: 'NULL' | 'DEFAULT';
}

/**
 * User defined column type of a character field in PostgreSQL.
 */
export type CharacterColumnType = 'varchar' | 'bpchar' | 'text';

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
  | 'decimal'
  | 'int'
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
  referencedSchema?: string;
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
  defaultValue?: string | AutocompleteOption;
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
  comment?: string;
  /**
   * Foreign key relation of the column.
   */
  foreignKeyRelation?: ForeignKeyRelation;
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
  primaryKey: string;
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
 * Represents a column in the data browser.
 */
export interface DataBrowserGridColumn<TData extends object = {}>
  extends ColumnInstance<TData>,
    Omit<DatabaseColumn, 'id' | 'name' | 'type' | 'defaultValue'> {
  /**
   * Function to be called when the cell is saved.
   */
  onCellEdit?: (options: {
    row: DataBrowserGridRow<TData>;
    columnsToUpdate: Record<string, ColumnUpdateOptions>;
  }) => Promise<Row<TData>>;
  /**
   * Determines whether or not the cell is editable.
   */
  isEditable?: boolean;
  /**
   * Determines whether or not the column is disabled.
   */
  isDisabled?: boolean;
  /**
   * Default value of the column.
   */
  defaultValue?: any;
  /**
   * Determines whether or not the default value is custom.
   */
  isDefaultValueCustom?: boolean;
  /**
   * More generic type of the column. Determines what type of input field is
   * rendered.
   */
  type?: 'text' | 'number' | 'date' | 'boolean' | 'uuid';
  /**
   * The actual type alias of the column.
   *
   * @example 'varchar' | 'char' | 'int8' ...
   */
  specificType?: ColumnType;
  /**
   * The maximum length of the column.
   */
  maxLength?: number | null;
  /**
   * Determines whether or not the cell content is copiable.
   */
  isCopiable?: boolean;
}

/**
 * Represents a cell in the data browser.
 */
export interface DataBrowserGridCell<TData extends object = {}, TValue = any>
  extends Omit<Cell<TData, TValue>, 'column'> {
  /**
   * Column name.
   */
  column: DataBrowserGridColumn<TData>;
}

/**
 * Represents a row in the data browser.
 */
export interface DataBrowserGridRow<TData extends object = {}>
  extends Row<TData> {
  /**
   * List of cells in the row.
   */
  cells: DataBrowserGridCell<TData>[];
}

/**
 * Represents the properties of a cell.
 */
export interface DataBrowserGridCellProps<
  TData extends object = {},
  TValue = any,
> extends CellProps<TData, TValue> {
  /**
   * Data browser grid column props.
   */
  column: DataBrowserGridColumn<TData>;
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
  | '_in_hasura'
  | '_nin'
  | '_nin_hasura'
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
  | '_is_null';

/**
 * Represents a rule. A rule is a single condition in a rule group.
 */
export interface Rule {
  column: string;
  operator: HasuraOperator;
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
  unsupported?: Record<string, any>[];
}
