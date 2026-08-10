import { type GraphQLInputField, GraphQLNonNull } from 'graphql';
import stringifyGraphQLInputObject from '@/features/orgs/projects/remote-schemas/utils/stringifyGraphQLInputObject';
import type { PresetExpression } from './types';

export default function serializePresetExpression(
  expr: PresetExpression,
  arg: GraphQLInputField,
): string | undefined {
  switch (expr.kind) {
    case 'null':
      return arg.type instanceof GraphQLNonNull ? '"null"' : 'null';
    case 'boolean':
    case 'number':
      return String(expr.value);
    case 'enum':
      return expr.value;
    case 'sessionVariable':
      return `"${expr.key}"`;
    case 'string':
      return `"${expr.value}"`;
    case 'list': {
      const items = expr.items.map((item) =>
        serializePresetExpression(item, arg),
      );
      return `[${items.join(',')}]`;
    }
    case 'object':
      return stringifyGraphQLInputObject(expr.entries, arg);
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}
