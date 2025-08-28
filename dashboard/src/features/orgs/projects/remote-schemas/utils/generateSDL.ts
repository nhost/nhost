import type {
  ArgTreeType,
  CustomFieldType,
  FieldType,
  RemoteSchemaFields,
} from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import type { GraphQLInputField } from 'graphql';
import checkDefaultGQLScalarType from './checkDefaultGQLScalarType';
import formatArg from './formatArg';

const checkEmptyType = (type: RemoteSchemaFields) => {
  const isChecked = (element: FieldType | CustomFieldType) => element.checked;
  if (type.children) {
    return type.children.some(isChecked);
  }
  return undefined;
};

/**
 * Builds the SDL string for each field / type.
 * @param type - Data source object containing a schema field.
 * @param argTree - Arguments tree in case of types with argument presets.
 * @returns SDL string for passed field.
 */
const getSDLField = (
  type: RemoteSchemaFields,
  argTree: Record<string, any> | null,
): string => {
  if (!checkEmptyType(type)) {
    return '';
  } // check if no child is selected for a type

  let result = ``;
  const typeName: string = type.name;

  // add scalar fields to SDL
  if (typeName.startsWith('scalar')) {
    if (type.typeName && checkDefaultGQLScalarType(type.typeName)) {
      return result; // if default GQL scalar type, return empty string
    }
    result = `${typeName}`;
    return `${result}\n`;
  }

  // add union fields to SDL
  if (typeName.startsWith('union') && type.children) {
    result = `${typeName} =`;
    type.children.forEach((t) => {
      if (t.checked) {
        result = `${result} ${t.name} |`;
      }
    });
    result = result.substring(0, result.length - 1);
    return `${result}\n`;
  }

  // add other fields to SDL
  result = `${typeName}{`;

  if (type.children) {
    type.children.forEach((f) => {
      if (!f.checked) {
        return null;
      }

      let fieldStr = f.name;
      let valueStr = '';
      // enum types don't have args
      if (!typeName.startsWith('enum')) {
        if (f.args && !isEmptyValue(f.args)) {
          fieldStr = `${fieldStr}(`;
          Object.values(f.args).forEach((arg: GraphQLInputField) => {
            valueStr = `${arg.name} : ${arg.type.toString()}`;

            // add default value after type definition if it exists
            if (arg.defaultValue !== undefined) {
              const defaultValue = formatArg({
                arg,
                argName: arg.defaultValue as string,
              });
              valueStr = `${valueStr} = ${defaultValue} `;
            }

            const argName = argTree?.[type?.name]?.[f?.name]?.[arg?.name];

            if (argName) {
              const preset = formatArg({ arg, argName });
              if (!isEmptyValue(preset)) {
                valueStr = `${valueStr} @preset(value: ${preset}) `;
              }
            }

            fieldStr = `${fieldStr + valueStr} `;
          });
          fieldStr = `${fieldStr})`;

          fieldStr = `${fieldStr}: ${f.return} `;
        } else {
          // normal data type - ie: without arguments/ presets
          fieldStr =
            f.defaultValue === undefined
              ? `${fieldStr} : ${f.return}`
              : `${fieldStr} : ${f.return} = ${f.defaultValue}`;
        }
      }
      // only need the arg string for input object types
      if (typeName.startsWith('input')) {
        result = `${result}
      ${valueStr}`;
      } else {
        result = `${result}
      ${fieldStr}`;
      }
      return true;
    });
  }
  return `${result}\n}`;
};

/**
 * Generate SDL string having input types and object types.
 * @param types - Remote schema introspection schema.
 * @returns String having all enum types and scalar types.
 */
export default function generateSDL(
  types: RemoteSchemaFields[] | FieldType[],
  argTree: ArgTreeType,
) {
  let prefix = `schema{`;
  let result = '';

  types.forEach((type) => {
    const fieldDef = getSDLField(type, argTree);

    if (
      !isEmptyValue(fieldDef) &&
      type.typeName === '__query_root' &&
      type.name
    ) {
      const name = type.name.split(' ')[1];
      prefix = `${prefix}
      query: ${name}`;
    }
    if (
      !isEmptyValue(fieldDef) &&
      type.typeName === '__mutation_root' &&
      type.name
    ) {
      const name = type.name.split(' ')[1];

      prefix = `${prefix}
      mutation: ${name}`;
    }
    if (!isEmptyValue(fieldDef)) {
      result = `${result}\n${fieldDef}\n`;
    }
  });

  prefix =
    prefix === `schema{`
      ? ''
      : `${prefix}
}\n`;

  if (isEmptyValue(result)) {
    return '';
  }

  return `${prefix} ${result}`;
}
