import { isJSONString } from '@/lib/utils';
import type { InputValueDefinitionNode } from 'graphql';
import parseObjectField from './parseObjectField';

export default function getDirectives(field: InputValueDefinitionNode) {
  let res: unknown | Record<string, any>;
  const preset = field?.directives?.find(
    (dir) => dir?.name?.value === 'preset',
  );
  if (preset?.arguments?.[0]) {
    res = parseObjectField(preset.arguments[0]);
  }
  if (typeof res === 'object') {
    return res;
  }
  if (typeof res === 'string' && isJSONString(res)) {
    return JSON.parse(res);
  }
  return res;
}
