import type { FieldDefinitionNode } from 'graphql';
import getDirectives from './getDirectives';

export default function getPresets(field: FieldDefinitionNode) {
  const res: Record<string, any> = {};
  field?.arguments?.forEach((arg) => {
    if (arg.directives && arg.directives.length > 0) {
      res[arg?.name?.value] = getDirectives(arg);
    }
  });
  return res;
}
