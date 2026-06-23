import { parse, print } from 'graphql';
import type { ClientCustomType } from '@/features/orgs/projects/actions/utils/customTypesUtils';
import type { CustomTypeObjectField } from '@/utils/hasura-api/generated/schemas';

function composeDescription(description?: string): string {
  return description ? `${JSON.stringify(description)}\n` : '';
}

function composeFields(fields: CustomTypeObjectField[]): string {
  return fields
    .map(
      (field) =>
        `  ${composeDescription(field.description)}${field.name}: ${field.type}`,
    )
    .join('\n');
}

function composeTypeSdl(type: ClientCustomType): string {
  const description = composeDescription(type.description);

  switch (type.kind) {
    case 'scalar':
      return `${description}scalar ${type.name}`;
    case 'enum': {
      if (!type.values?.length) {
        return `${description}enum ${type.name}`;
      }
      const values = type.values
        .map(
          (enumValue) =>
            `  ${composeDescription(enumValue.description)}${enumValue.value}`,
        )
        .join('\n');
      return `${description}enum ${type.name} {\n${values}\n}`;
    }
    case 'object': {
      if (!type.fields?.length) {
        return `${description}type ${type.name}`;
      }
      return `${description}type ${type.name} {\n${composeFields(type.fields)}\n}`;
    }
    case 'input_object': {
      if (!type.fields?.length) {
        return `${description}input ${type.name}`;
      }
      return `${description}input ${type.name} {\n${composeFields(type.fields)}\n}`;
    }
    default: {
      const exhaustive: never = type.kind;
      throw new Error(`Unexpected custom type kind: ${exhaustive}`);
    }
  }
}

export default function composeTypesSdl(types: ClientCustomType[]): string {
  if (types.length === 0) {
    return '';
  }

  const sdl = types.map(composeTypeSdl).join('\n\n');
  return `${print(parse(sdl)).trim()}\n`;
}
