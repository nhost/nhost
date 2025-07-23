import type { GraphQLArgument, GraphQLField } from 'graphql';

export type EnvOrValueHeader =
  | {
      name: string;
      value: string;
      value_from_env: never;
    }
  | {
      name: string;
      value: never;
      value_from_env: string;
    };

export interface MetadataOperationOptions {
  appUrl: string;
  adminSecret: string;
}

export type RemoteSchemaRelationshipType = 'remote-schema' | 'database';

export type PermissionsType = {
  definition: { schema: string };
  role: string;
  remote_schema_name: string;
  comment: string | null;
};

export type RemoteSchemaAccessLevel = 'full' | 'partial' | 'none';

export type ArgTreeType = {
  [key: string]: string | number | ArgTreeType;
};

export type CustomFieldType = {
  name: string;
  checked: boolean;
  args?: Record<string, GraphQLArgument>;
  return?: string;
  typeName?: string;
  children?: FieldType[];
  defaultValue?: any;
  isInputObjectType?: boolean;
  parentName?: string;
};

export type FieldType = CustomFieldType & GraphQLField<any, any>;

export type RemoteSchemaFields =
  | {
      name: string;
      typeName: string;
      children: FieldType[] | CustomFieldType[];
    }
  | FieldType;
