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

export type ArgTreeType = {
  [key: string]: ArgLeafType | ArgTreeType;
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
  expanded?: boolean;
};

export type FieldType = CustomFieldType & GraphQLField<any, any>;

export type RemoteSchemaFields =
  | {
      name: string;
      typeName: string;
      children: FieldType[] | CustomFieldType[];
    }
  | FieldType;

export type ChildArgumentType = {
  children?: GraphQLInputFieldMap | GraphQLEnumValue[];
  path?: string;
  childrenType?: GraphQLType;
};
