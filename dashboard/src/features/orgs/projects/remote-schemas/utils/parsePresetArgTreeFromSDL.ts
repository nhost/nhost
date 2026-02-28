import type {
  DocumentNode,
  FieldDefinitionNode,
  GraphQLSchema,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from 'graphql';
import { parse } from 'graphql';
import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
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
    const argTree: ArgTreeType = {};

    defs?.forEach((def) => {
      const defName = def?.name?.value;
      const hasFields = Array.isArray(def?.fields);
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
        const typeEntry: ArgTreeType = {};
        def.fields?.forEach((field) => {
          if (field.directives && field.directives.length > 0) {
            const fieldName = field.name?.value;
            if (!fieldName) {
              return;
            }
            const preset = getPresetDirective(field);
            if (preset !== undefined) {
              typeEntry[fieldName] = {};
              (typeEntry[fieldName] as ArgTreeType)[fieldName] =
                preset as ArgTreeType[keyof ArgTreeType];
            }
          }
        });

        const inputMap: ArgTreeType = { [typeKey]: typeEntry };

        Object.assign(argTree, inputMap);
      }
    });

    return argTree;
  } catch (e) {
    console.error(e);
    return {} as ArgTreeType;
  }
}
