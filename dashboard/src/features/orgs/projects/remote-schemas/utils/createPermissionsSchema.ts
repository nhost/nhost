import { buildSchema, type GraphQLSchema } from 'graphql';
import { prependPresetDirectiveSDL } from './prependPresetDirectiveSDL';

export function createPermissionsSchema(
  permissionSDL?: string | null,
): GraphQLSchema | null {
  if (!permissionSDL?.trim()) {
    return null;
  }

  try {
    const schemaSDL = prependPresetDirectiveSDL(permissionSDL);
    return buildSchema(schemaSDL);
  } catch {
    return null;
  }
}
