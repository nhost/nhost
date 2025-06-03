export type AllowedRootFields = ('query' | 'mutation' | 'subscription')[];

export type ArgValue = {
  kind: 'field' | 'variable';
  value: string;
  type: string;
};

export type RelationshipFields = {
  key: string;
  argValue: ArgValue | null;
  checkable: boolean;
  depth: number;
  type: 'field' | 'arg';
};

export type HasuraRsFields = string[];

export type RemoteField = {
  [FieldName: string]: {
    arguments: InputArgumentsType | never;
    field?: RemoteField;
  };
};

export type InputArgumentValueType =
  | string
  | number
  | boolean
  | { [key: string]: any }
  | any[]
  | null;

export type InputArgumentsType = Record<string, InputArgumentValueType>;

export type TreeNode = {
  title: React.ReactNode;
  key: string;
  depth: number;
  checkable: boolean;
  type: 'field' | 'arg';
  argValue?: ArgValue | null;
  disabled?: boolean;
  children?: TreeNode[];
};

// React-complex-tree types
export type ComplexTreeData = Record<string, ComplexTreeItem>;

export type ComplexTreeItem = {
  index: string;
  canMove: boolean;
  isFolder: boolean;
  children?: string[];
  data: string | React.ReactNode;
  canRename: boolean;
};

export type ComplexTreeViewState = {
  focusedItem?: string;
  expandedItems: string[];
  selectedItems: string[];
};

// GraphQL Type structures from introspection
export type GraphQLTypeForVisualization = {
  kind: string;
  name: string;
  description?: string;
  fields?: GraphQLFieldForVisualization[];
  inputFields?: GraphQLInputFieldForVisualization[];
  interfaces?: GraphQLTypeForVisualization[];
  possibleTypes?: GraphQLTypeForVisualization[];
  enumValues?: GraphQLEnumValueForVisualization[];
  ofType?: GraphQLTypeForVisualization;
};

export type GraphQLFieldForVisualization = {
  name: string;
  description?: string;
  args: GraphQLInputFieldForVisualization[];
  type: GraphQLTypeForVisualization;
  isDeprecated: boolean;
  deprecationReason?: string;
};

export type GraphQLInputFieldForVisualization = {
  name: string;
  description?: string;
  type: GraphQLTypeForVisualization;
  defaultValue?: string;
};

export type GraphQLEnumValueForVisualization = {
  name: string;
  description?: string;
  isDeprecated: boolean;
  deprecationReason?: string;
};
