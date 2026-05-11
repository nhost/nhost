export const DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS = 60;

const SESSION_VARIABLE_PREFIX = 'x-hasura-';

export function isSessionVariable(value: string): boolean {
  return value.toLowerCase().startsWith(SESSION_VARIABLE_PREFIX);
}

export const SDL_TYPE_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'input',
  'enum',
  'scalar',
  'union',
  'interface',
]);

export const BUILT_IN_SCALARS: ReadonlySet<string> = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
]);
