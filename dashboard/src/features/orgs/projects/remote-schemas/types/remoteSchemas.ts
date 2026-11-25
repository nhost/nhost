import type {
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputFieldMap,
  GraphQLType,
} from 'graphql';

export type RemoteSchemaRelationshipType = 'remote-schema' | 'database';

export type RemoteSchemaAccessLevel = 'full' | 'partial' | 'none';

export type ArgLeafType = string | number | boolean | null;

export interface ArgTreeType {
  [key: string]: ArgLeafType | ArgTreeType;
}

export interface CustomFieldType {
  name: string;
  checked: boolean;
  args?: Record<string, GraphQLArgument>;
  return?: string;
  typeName?: string;
  children?: FieldType[];
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  defaultValue?: any;
  isInputObjectType?: boolean;
  parentName?: string;
  expanded?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
export type FieldType = CustomFieldType & GraphQLField<any, any>;

export type RemoteSchemaFields =
  | {
      name: string;
      typeName: string;
      children: FieldType[] | CustomFieldType[];
    }
  | FieldType;

export interface ChildArgumentType {
  children?: GraphQLInputFieldMap | GraphQLEnumValue[];
  path?: string;
  childrenType?: GraphQLType;
}
