interface ArgValue {
  kind: 'field' | 'variable';
  value: string;
  type: string;
}

export interface RelationshipFields {
  key: string;
  argValue: ArgValue | null;
  checkable: boolean;
  depth: number;
  type: 'field' | 'arg';
}

export type ComplexTreeData = Record<string, ComplexTreeItem>;

interface ComplexTreeItem {
  index: string;
  canMove: boolean;
  isFolder: boolean;
  children?: string[];
  data: string | React.ReactNode;
  canRename: boolean;
}
