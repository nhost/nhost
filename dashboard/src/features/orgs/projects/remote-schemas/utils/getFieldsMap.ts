import type { FieldDefinitionNode } from 'graphql';
import getPresetDirective from './getPresetDirective';

function getPresets(field: FieldDefinitionNode) {
  const res: Record<string, any> = {};
  field?.arguments?.forEach((arg) => {
    if (arg.directives && arg.directives.length > 0) {
      res[arg?.name?.value] = getPresetDirective(arg);
    }
  });
  return res;
}

export default function getFieldsMap(
  fields: FieldDefinitionNode[],
  parentName: string,
) {
  const typeKey = `type ${parentName}`;
  const typeFields = (fields ?? []).reduce(
    (acc, field) => {
      const fieldName = field?.name?.value;
      if (fieldName) {
        acc[fieldName] = getPresets(field);
      }
      return acc;
    },
    {} as Record<string, any>,
  );

  return { [typeKey]: typeFields } as Record<string, any>;
}
