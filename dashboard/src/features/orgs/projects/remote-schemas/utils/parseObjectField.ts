import type {
  ArgumentNode,
  BooleanValueNode,
  EnumValueNode,
  FloatValueNode,
  IntValueNode,
  ObjectFieldNode,
  StringValueNode,
} from 'graphql';

export default function parseObjectField(arg: ArgumentNode | ObjectFieldNode) {
  if (arg?.value?.kind === 'IntValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'FloatValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'StringValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'BooleanValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'EnumValue' && arg?.value?.value) {
    return arg?.value?.value;
  }

  if (arg?.value?.kind === 'NullValue') {
    return null;
  }

  // nested values
  if (
    arg?.value?.kind === 'ObjectValue' &&
    arg?.value?.fields &&
    arg?.value?.fields?.length > 0
  ) {
    const res: Record<string, any> = {};
    arg?.value?.fields.forEach((f: ObjectFieldNode) => {
      res[f.name.value] = parseObjectField(f);
    });
    return res;
  }

  type NodeType =
    | IntValueNode
    | FloatValueNode
    | StringValueNode
    | BooleanValueNode
    | EnumValueNode;

  // Array values
  if (
    arg?.value?.kind === 'ListValue' &&
    arg?.value?.values &&
    arg?.value?.values?.length > 0
  ) {
    const res = arg.value.values.reduce((acc, valueNode, i, arr) => {
      const isValid =
        valueNode.kind === 'IntValue' ||
        valueNode.kind === 'FloatValue' ||
        valueNode.kind === 'StringValue' ||
        valueNode.kind === 'BooleanValue' ||
        valueNode.kind === 'EnumValue';

      if (isValid) {
        const vNode = valueNode as NodeType;
        const isOnlyItem = arr.length === 1;
        const isFirstItem = i === 0;
        const isLastItem = i === arr.length - 1;

        if (isOnlyItem) {
          return `[${vNode.value}]`;
        }

        if (isFirstItem) {
          return `[${vNode.value}`;
        }

        if (isLastItem) {
          return `${acc}, ${vNode.value}]`;
        }

        return `${acc}, ${vNode.value}`;
      }

      return acc;
    }, '');

    return res;
  }
  return undefined;
}
