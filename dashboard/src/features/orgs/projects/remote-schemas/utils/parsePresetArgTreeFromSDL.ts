import type {
  DocumentNode,
  FieldDefinitionNode,
  GraphQLSchema,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from 'graphql';
import { parse } from 'graphql';
import getFieldsMap from './getFieldsMap';
import getPresetDirective from './getPresetDirective';
import getSchemaRoots from './getSchemaRoots';

type DefinitionWithFields =
  | ObjectTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

export default function parsePresetArgTreeFromSDL(
  definition: string,
  introspectionSchema: GraphQLSchema,
) {
  const roots = getSchemaRoots(introspectionSchema);
  try {
    const doc: DocumentNode = parse(definition);
    const defs = doc.definitions as DefinitionWithFields[];
    const argTree: Record<string, any> = {};

    defs?.forEach((def) => {
      const defName = def?.name?.value;
      const hasFields = Array.isArray((def as any)?.fields);
      if (!defName || !hasFields) {
        return;
      }

      if (roots.includes(defName)) {
        const map = getFieldsMap(
          (def.fields as FieldDefinitionNode[]) ?? [],
          defName,
        );
        Object.assign(argTree, map);
        return;
      }

      if (def.kind === 'InputObjectTypeDefinition') {
        const typeKey = `input ${defName}`;
        const inputMap: Record<string, any> = { [typeKey]: {} };
        def.fields?.forEach((field) => {
          if (field.directives && field.directives.length > 0) {
            inputMap[typeKey][field.name?.value] = {};
            inputMap[typeKey][field.name?.value][field.name?.value] =
              getPresetDirective(field);
          }
        });
        Object.assign(argTree, inputMap);
      }
    });

    return argTree;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return {};
  }
}
