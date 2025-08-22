import type { FieldDefinitionNode } from 'graphql';
import getPresets from './getPresets';

export default function getFieldsMap(
  fields: FieldDefinitionNode[],
  parentName: string,
) {
  const type = `type ${parentName}`;
  const res: Record<string, any> = { [type]: {} };
  fields.forEach((field) => {
    res[type][field?.name?.value] = getPresets(field);
  });
  return res;
}
