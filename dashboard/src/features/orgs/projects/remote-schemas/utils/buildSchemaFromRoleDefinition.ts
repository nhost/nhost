import { buildSchema, type GraphQLSchema } from 'graphql';
import { addPresetDefinition } from './addPresetDefinition';

export function buildSchemaFromRoleDefinition(roleDefinition: string) {
  let permissionsSchema: GraphQLSchema | null = null;

  try {
    const newDef = addPresetDefinition(roleDefinition);
    permissionsSchema = buildSchema(newDef);
  } catch (err) {
    return null;
  }
  return permissionsSchema;
}
