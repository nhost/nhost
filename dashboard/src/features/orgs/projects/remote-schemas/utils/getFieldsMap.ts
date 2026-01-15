import type { FieldDefinitionNode } from 'graphql';
import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import getPresetDirective from './getPresetDirective';

function getPresets(field: FieldDefinitionNode) {
  const res: ArgTreeType = {};
  field?.arguments?.forEach((arg) => {
    if (arg.directives && arg.directives.length > 0) {
      const value = getPresetDirective(arg);
      if (value !== undefined) {
        res[arg?.name?.value] = value satisfies ArgTreeType[keyof ArgTreeType];
      }
    }
  });
  return res;
}

export default function getFieldsMap(
  fields: FieldDefinitionNode[],
  parentName: string,
) {
  const typeKey = `type ${parentName}`;
  const typeFields = (fields ?? []).reduce((acc, field) => {
    const fieldName = field?.name?.value;
    if (fieldName) {
      // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
      acc[fieldName] = getPresets(field);
    }
    return acc;
  }, {} satisfies ArgTreeType);

  return { [typeKey]: typeFields } satisfies ArgTreeType;
}
