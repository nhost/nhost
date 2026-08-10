import type {
  ArgumentNode,
  BooleanValueNode,
  EnumValueNode,
  FloatValueNode,
  InputValueDefinitionNode,
  IntValueNode,
  ObjectFieldNode,
  StringValueNode,
  ValueNode,
} from 'graphql';
import type {
  ArgLeafType,
  ArgTreeType,
} from '@/features/orgs/projects/remote-schemas/types';

function parseConstValue(node?: ValueNode) {
  if (!node) {
    return undefined;
  }

  switch (node.kind) {
    case 'IntValue':
    case 'FloatValue':
    case 'StringValue':
    case 'BooleanValue':
    case 'EnumValue': {
      return (
        node as
          | IntValueNode
          | FloatValueNode
          | StringValueNode
          | BooleanValueNode
          | EnumValueNode
      ).value;
    }
    case 'NullValue': {
      return null;
    }
    case 'ObjectValue': {
      const res: Record<string, unknown> = {};
      (node.fields ?? []).forEach((f: ObjectFieldNode) => {
        res[f.name.value] = parseConstValue(f.value);
      });
      return res;
    }
    case 'ListValue': {
      const scalarsOrEnums = (node.values ?? []).filter(
        (v) =>
          v.kind === 'IntValue' ||
          v.kind === 'FloatValue' ||
          v.kind === 'StringValue' ||
          v.kind === 'BooleanValue' ||
          v.kind === 'EnumValue',
      ) as Array<
        | IntValueNode
        | FloatValueNode
        | StringValueNode
        | BooleanValueNode
        | EnumValueNode
      >;

      if (scalarsOrEnums.length === 0) {
        return '';
      }

      const joined = scalarsOrEnums.map((n) => n.value).join(', ');
      return `[${joined}]`;
    }
    default:
      return undefined;
  }
}

function parseObjectField(arg: ArgumentNode | ObjectFieldNode) {
  return parseConstValue(arg?.value);
}

export default function getPresetDirective(
  field: InputValueDefinitionNode,
): ArgLeafType | ArgTreeType | undefined {
  const preset = field?.directives?.find(
    (dir) => dir?.name?.value === 'preset',
  );
  const firstArg = preset?.arguments?.[0];

  if (!firstArg) {
    return undefined;
  }

  return parseObjectField(firstArg) as ArgLeafType | ArgTreeType | undefined;
}
