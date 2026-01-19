import type { GraphQLInputField } from 'graphql';
import type {
  ArgTreeType,
  CustomFieldType,
  FieldType,
  RemoteSchemaFields,
} from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import isStandardGraphQLScalar from './isStandardGraphQLScalar';
import stringifyGraphQLValue from './stringifyGraphQLValue';

function hasAnySelectedChild(type: RemoteSchemaFields) {
  const isChecked = (element: FieldType | CustomFieldType) => element.checked;
  if (type.children) {
    return type.children.some(isChecked);
  }
  return undefined;
}

function printTypeSDL(
  type: RemoteSchemaFields,
  argTree: Record<string, unknown> | null,
): string {
  if (!hasAnySelectedChild(type)) {
    return '';
  }

  let result = '';
  const typeName = type.name;

  if (typeName.startsWith('scalar')) {
    if (type.typeName && isStandardGraphQLScalar(type.typeName)) {
      return result;
    }
    result = `${typeName}`;
    return `${result}\n`;
  }

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

  result = `${typeName}{`;

  if (type.children) {
    type.children.forEach((f) => {
      if (!f.checked) {
        return;
      }

      let fieldStr = f.name;
      let valueStr = '';

      if (!typeName.startsWith('enum')) {
        if (f.args && !isEmptyValue(f.args)) {
          fieldStr = `${fieldStr}(`;
          Object.values(f.args).forEach((arg: GraphQLInputField) => {
            valueStr = `${arg.name} : ${arg.type.toString()}`;

            if (arg.defaultValue !== undefined) {
              const defaultValue = stringifyGraphQLValue({
                arg,
                argName: arg.defaultValue as string,
              });
              valueStr = `${valueStr} = ${defaultValue} `;
            }

            const argName = argTree?.[type?.name]?.[f?.name]?.[arg?.name];
            if (argName) {
              const preset = stringifyGraphQLValue({ arg, argName });
              if (!isEmptyValue(preset)) {
                valueStr = `${valueStr} @preset(value: ${preset}) `;
              }
            }

            fieldStr = `${fieldStr + valueStr} `;
          });
          fieldStr = `${fieldStr})`;
          fieldStr = `${fieldStr}: ${f.return} `;
        } else {
          fieldStr =
            f.defaultValue === undefined
              ? `${fieldStr} : ${f.return}`
              : `${fieldStr} : ${f.return} = ${f.defaultValue}`;
        }
      }

      if (typeName.startsWith('input')) {
        result = `${result}\n      ${valueStr}`;
      } else {
        result = `${result}\n      ${fieldStr}`;
      }
    });
  }

  return `${result}\n}`;
}

export default function composePermissionSDL(
  types: RemoteSchemaFields[] | FieldType[],
  argTree: ArgTreeType,
) {
  let prefix = `schema{`;
  let result = '';

  types.forEach((type) => {
    const fieldDef = printTypeSDL(type, argTree);

    if (
      !isEmptyValue(fieldDef) &&
      type.typeName === '__query_root' &&
      type.name
    ) {
      const name = type.name.split(' ')[1];
      prefix = `${prefix}\n      query: ${name}`;
    }
    if (
      !isEmptyValue(fieldDef) &&
      type.typeName === '__mutation_root' &&
      type.name
    ) {
      const name = type.name.split(' ')[1];
      prefix = `${prefix}\n      mutation: ${name}`;
    }
    if (!isEmptyValue(fieldDef)) {
      result = `${result}\n${fieldDef}\n`;
    }
  });

  prefix = prefix === `schema{` ? '' : `${prefix}\n}\n`;
  if (isEmptyValue(result)) {
    return '';
  }
  return `${prefix} ${result}`;
}
