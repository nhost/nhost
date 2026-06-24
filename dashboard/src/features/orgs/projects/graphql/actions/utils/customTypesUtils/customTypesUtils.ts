import { unwrapType } from '@/features/orgs/projects/graphql/actions/utils/graphqlTypeUtils';
import type {
  ActionDefinition,
  ActionRelationship,
  CustomTypeObjectField,
  CustomTypes,
  EnumValueDefinition,
} from '@/utils/hasura-api/generated/schemas';

export type ClientCustomTypeKind =
  | 'scalar'
  | 'enum'
  | 'object'
  | 'input_object';

export interface ClientCustomType {
  kind: ClientCustomTypeKind;
  name: string;
  description?: string;
  fields?: CustomTypeObjectField[];
  values?: EnumValueDefinition[];
  relationships?: ActionRelationship[];
}

export function parseCustomTypes(customTypes: CustomTypes): ClientCustomType[] {
  return [
    ...(customTypes.scalars ?? []).map<ClientCustomType>((scalarType) => ({
      ...scalarType,
      kind: 'scalar',
    })),
    ...(customTypes.enums ?? []).map<ClientCustomType>((enumType) => ({
      ...enumType,
      kind: 'enum',
    })),
    ...(customTypes.input_objects ?? []).map<ClientCustomType>(
      (inputObjectType) => ({
        ...inputObjectType,
        kind: 'input_object',
      }),
    ),
    ...(customTypes.objects ?? []).map<ClientCustomType>((objectType) => ({
      ...objectType,
      kind: 'object',
    })),
  ];
}

export function reformCustomTypes(types: ClientCustomType[]): CustomTypes {
  const customTypes: Required<CustomTypes> = {
    scalars: [],
    enums: [],
    input_objects: [],
    objects: [],
  };

  types.forEach((type) => {
    const description = type.description
      ? { description: type.description }
      : {};

    switch (type.kind) {
      case 'scalar':
        customTypes.scalars.push({ name: type.name, ...description });
        break;
      case 'enum':
        customTypes.enums.push({
          name: type.name,
          ...description,
          values: type.values ?? [],
        });
        break;
      case 'input_object':
        customTypes.input_objects.push({
          name: type.name,
          ...description,
          fields: type.fields ?? [],
        });
        break;
      case 'object':
        customTypes.objects.push({
          name: type.name,
          ...description,
          fields: type.fields ?? [],
          ...(type.relationships ? { relationships: type.relationships } : {}),
        });
        break;
      default: {
        const exhaustive: never = type.kind;
        throw new Error(`Unexpected custom type kind: ${exhaustive}`);
      }
    }
  });

  return customTypes;
}

export function mergeCustomTypes(
  newTypes: ClientCustomType[],
  existingTypes: ClientCustomType[],
): ClientCustomType[] {
  const mergedTypes = [...existingTypes];
  const existingTypeIndexes = new Map(
    existingTypes.map((type, index) => [type.name, index]),
  );

  newTypes.forEach((newType) => {
    const existingIndex = existingTypeIndexes.get(newType.name);
    if (existingIndex !== undefined) {
      mergedTypes[existingIndex] = newType;
    } else {
      mergedTypes.push(newType);
    }
  });

  return mergedTypes;
}

export function hydrateTypeRelationships(
  newTypes: ClientCustomType[],
  existingTypes: ClientCustomType[],
): ClientCustomType[] {
  const existingTypesByName = new Map(
    existingTypes.map((type) => [type.name, type]),
  );

  return newTypes.map((type) => {
    const existingType = existingTypesByName.get(type.name);
    if (
      type.kind === 'object' &&
      existingType?.kind === 'object' &&
      existingType.relationships
    ) {
      return { ...type, relationships: existingType.relationships };
    }
    return type;
  });
}

export function getActionTypes(
  actionDefinition: Pick<ActionDefinition, 'arguments' | 'output_type'>,
  allTypes: ClientCustomType[],
): ClientCustomType[] {
  const typesByName = new Map(allTypes.map((type) => [type.name, type]));
  const visitedTypenames = new Set<string>();
  const actionTypes: ClientCustomType[] = [];

  function collectDependentTypes(wrappedTypename: string) {
    const { typename } = unwrapType(wrappedTypename);
    if (visitedTypenames.has(typename)) {
      return;
    }

    const type = typesByName.get(typename);
    if (!type) {
      return;
    }

    visitedTypenames.add(typename);
    actionTypes.push(type);

    if (type.kind === 'object' || type.kind === 'input_object') {
      type.fields?.forEach((field) => {
        collectDependentTypes(field.type);
      });
    }
  }

  actionDefinition.arguments?.forEach((argument) => {
    collectDependentTypes(argument.type);
  });
  collectDependentTypes(actionDefinition.output_type);

  return actionTypes;
}
