import type {
  LogicalModelItem,
  LogicalModelType,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

export interface DependentLogicalModel {
  name: string;
  fields: string[];
}

export interface LogicalModelDependents {
  nativeQueries: string[];
  logicalModels: DependentLogicalModel[];
}

export interface FindLogicalModelDependentsOptions {
  name: string;
  logicalModels: LogicalModelItem[];
  nativeQueries: NativeQueryItem[];
}

function typeReferencesLogicalModel(
  type: LogicalModelType,
  name: string,
): boolean {
  if ('logical_model' in type) {
    return type.logical_model === name;
  }

  if ('array' in type) {
    return typeReferencesLogicalModel(type.array, name);
  }

  return false;
}

export function findLogicalModelDependents({
  name,
  logicalModels,
  nativeQueries,
}: FindLogicalModelDependentsOptions): LogicalModelDependents {
  return {
    nativeQueries: nativeQueries
      .filter((nativeQuery) => nativeQuery.returns === name)
      .map((nativeQuery) => nativeQuery.root_field_name),
    logicalModels: logicalModels
      // A self-reference disappears together with the model, so it never blocks removal.
      .filter((logicalModel) => logicalModel.name !== name)
      .map((logicalModel) => ({
        name: logicalModel.name,
        fields: logicalModel.fields
          .filter((field) => typeReferencesLogicalModel(field.type, name))
          .map((field) => field.name),
      }))
      .filter((logicalModel) => logicalModel.fields.length > 0),
  };
}

export function countLogicalModelDependents({
  nativeQueries,
  logicalModels,
}: LogicalModelDependents): number {
  return nativeQueries.length + logicalModels.length;
}
