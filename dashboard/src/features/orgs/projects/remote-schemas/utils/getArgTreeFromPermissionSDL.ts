import type {
  DocumentNode,
  FieldDefinitionNode,
  GraphQLSchema,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from 'graphql';
import { parse } from 'graphql';
import getDirectives from './getDirectives';
import getFieldsMap from './getFieldsMap';
import getSchemaRoots from './getSchemaRoots';

type ArgTypesDefinition =
  | ObjectTypeDefinitionNode
  | InputObjectTypeDefinitionNode;

export default function getArgTreeFromPermissionSDL(
  definition: string,
  introspectionSchema: GraphQLSchema,
) {
  const roots = getSchemaRoots(introspectionSchema);
  try {
    const schema: DocumentNode = parse(definition);
    const defs = schema.definitions as ArgTypesDefinition[];
    const argTree = defs?.reduce((acc, i) => {
      if (i.name && i.fields && roots.includes(i?.name?.value)) {
        const res = getFieldsMap(
          i.fields as FieldDefinitionNode[],
          i.name.value,
        );
        return { ...acc, ...res };
      }
      if (i.name && i.fields && i.kind === 'InputObjectTypeDefinition') {
        const type = `input ${i.name.value}`;
        const res: Record<string, any> = { [type]: {} };
        i.fields.forEach((field) => {
          if (field.directives && field.directives.length > 0) {
            res[type][field.name?.value] = {};
            res[type][field.name?.value][field.name?.value] =
              getDirectives(field);
          }
        });
        return { ...acc, ...res };
      }
      return acc;
    }, {});
    return argTree;
  } catch (e) {
    console.error(e);
    return {};
  }
}
