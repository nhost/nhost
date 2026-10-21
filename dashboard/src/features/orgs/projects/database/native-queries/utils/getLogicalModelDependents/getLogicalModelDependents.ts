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

export interface GetLogicalModelDependentsOptions {
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

/**
 * Lists the native queries and logical models still referencing `name`, so a
 * delete flow can tell whether the model is safe to remove. A model that only
 * references itself is excluded: that field disappears together with the model,
 * so it never blocks removal.
 */
export default function getLogicalModelDependents({
  name,
  logicalModels,
  nativeQueries,
}: GetLogicalModelDependentsOptions): LogicalModelDependents {
  return {
    nativeQueries: nativeQueries
      .filter((nativeQuery) => nativeQuery.returns === name)
      .map((nativeQuery) => nativeQuery.root_field_name),
    logicalModels: logicalModels
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
