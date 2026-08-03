import type {
  LogicalModelField,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelTypeNode =
  | { kind: 'scalar'; scalar: string; nullable: boolean }
  | { kind: 'logical_model'; logicalModel: string; nullable: boolean }
  | { kind: 'array'; item: LogicalModelTypeNode; nullable: boolean };

export interface LogicalModelFieldNode {
  name: string;
  type: LogicalModelTypeNode;
  description: string;
}

export const createEmptyTypeNode = (): LogicalModelTypeNode => ({
  kind: 'scalar',
  scalar: '',
  nullable: true,
});

export const logicalModelTypeToForm = (
  type: LogicalModelType,
): LogicalModelTypeNode => {
  if ('scalar' in type) {
    return { kind: 'scalar', scalar: type.scalar, nullable: type.nullable };
  }

  if ('logical_model' in type) {
    return {
      kind: 'logical_model',
      logicalModel: type.logical_model,
      nullable: type.nullable,
    };
  }

  return {
    kind: 'array',
    item: logicalModelTypeToForm(type.array),
    nullable: type.nullable,
  };
};

export const formTypeToLogicalModelType = (
  type: LogicalModelTypeNode,
): LogicalModelType => {
  if (type.kind === 'scalar') {
    return { scalar: type.scalar, nullable: type.nullable };
  }

  if (type.kind === 'logical_model') {
    return { logical_model: type.logicalModel, nullable: type.nullable };
  }

  return {
    array: formTypeToLogicalModelType(type.item),
    nullable: type.nullable,
  };
};

export const logicalModelFieldsToForm = (
  fields: LogicalModelField[],
): LogicalModelFieldNode[] =>
  fields.map((field) => ({
    name: field.name,
    type: logicalModelTypeToForm(field.type),
    description: field.description ?? '',
  }));

export const formFieldsToLogicalModelFields = (
  fields: LogicalModelFieldNode[],
): LogicalModelField[] =>
  fields.map((field) => {
    const description = field.description.trim();

    return {
      name: field.name.trim(),
      type: formTypeToLogicalModelType(field.type),
      ...(description ? { description } : {}),
    };
  });
