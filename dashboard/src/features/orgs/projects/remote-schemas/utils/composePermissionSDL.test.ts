import { buildSchema } from 'graphql';
import buildRemoteSchemaFieldTree from './buildRemoteSchemaFieldTree';
import composePermissionSDL from './composePermissionSDL';
import { createPermissionsSchema } from './createPermissionsSchema';
import parsePresetArgTreeFromSDL from './parsePresetArgTreeFromSDL';

const introspectionSchema = buildSchema(`
  type Query {
    getThing(
      force: Boolean
      count: Int
      pi: Float
      name: String
      sessionVar: String
    ): String
  }
`);

function roundTrip(permissionSDL: string): string {
  const permissionsSchema = createPermissionsSchema(permissionSDL);
  const argTree = parsePresetArgTreeFromSDL(permissionSDL, introspectionSchema);
  const fields = buildRemoteSchemaFieldTree(
    introspectionSchema,
    permissionsSchema,
  );
  return composePermissionSDL(fields, argTree);
}

it('Boolean preset value `false` round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean @preset(value: false), count: Int, pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: false)');
  expect(sdl).not.toContain('@preset(value: "false")');
});

it('Boolean preset value `true` round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean @preset(value: true), count: Int, pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: true)');
  expect(sdl).not.toContain('@preset(value: "true")');
});

it('Int preset value 0 is preserved (not dropped as falsy)', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int @preset(value: 0), pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: 0)');
});

it('Int preset value 5431 round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int @preset(value: 5431), pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: 5431)');
  expect(sdl).not.toContain('@preset(value: "5431")');
});

it('Quoted boolean string is fixed to unquoted boolean on round-trip', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean @preset(value: "true"), count: Int, pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: true)');
});

it('Quoted numeric string is fixed to unquoted number on round-trip', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int @preset(value: "5431"), pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: 5431)');
});

it('Session variable on String field stays quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String, sessionVar: String @preset(value: "X-Hasura-User-Id")): String
    }
  `);
  expect(sdl).toContain('@preset(value: "X-Hasura-User-Id")');
});

it('Plain string preset is quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: "hello"), sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: "hello")');
});

it('Field without @preset emits no preset directive', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).not.toContain('@preset');
});

it('Float preset value 3.14 round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float @preset(value: 3.14), name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: 3.14)');
  expect(sdl).not.toContain('@preset(value: "3.14")');
});

it('String field with quoted "true" preset round-trips quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: "true"), sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: "true")');
  expect(sdl).not.toContain('@preset(value: true)');
});

it('String field with quoted "false" preset round-trips quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: "false"), sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: "false")');
  expect(sdl).not.toContain('@preset(value: false)');
});

it('String field with quoted numeric preset "5431" round-trips quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: "5431"), sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: "5431")');
  expect(sdl).not.toContain('@preset(value: 5431)');
});

it('String field with quoted "null" preset round-trips quoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: "null"), sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: "null")');
  expect(sdl).not.toContain('@preset(value: null)');
});

it('Boolean field with null preset round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean @preset(value: null), count: Int, pi: Float, name: String, sessionVar: String): String
    }
  `);
  expect(sdl).toContain('@preset(value: null)');
  expect(sdl).not.toContain('@preset(value: "null")');
});

it('nullable String field with null preset round-trips unquoted', () => {
  const sdl = roundTrip(`
    schema { query: Query }
    type Query {
      getThing(force: Boolean, count: Int, pi: Float, name: String @preset(value: null), sessionVar: String): String
    }
  `);
  expect(sdl).toMatch(/name\s*:\s*String\s*@preset\(value:\s*null\s*\)/);
  expect(sdl).not.toContain('@preset(value: "null")');
});

it('legacy JSON-object string preset on input-object arg rehydrates to a structured object literal', () => {
  const introspection = buildSchema(`
    input WhereInput { foo: String, bar: Int }
    type Query {
      getThing(where: WhereInput): String
    }
  `);
  const permissionSDL = `
    schema { query: Query }
    input WhereInput { foo: String, bar: Int }
    type Query {
      getThing(where: WhereInput @preset(value: "{\\"foo\\":\\"hello\\",\\"bar\\":1}")): String
    }
  `;
  const permissionsSchema = createPermissionsSchema(permissionSDL);
  const argTree = parsePresetArgTreeFromSDL(permissionSDL, introspection);
  const fields = buildRemoteSchemaFieldTree(introspection, permissionsSchema);
  const sdl = composePermissionSDL(fields, argTree);

  expect(sdl).toMatch(/foo:\s*"hello"/);
  expect(sdl).toMatch(/bar:\s*1/);
  expect(sdl).not.toMatch(/@preset\(value:\s*"\{/);
});

it('nested null on input-object field survives a no-op round-trip', () => {
  const introspection = buildSchema(`
    input WhereInput { foo: String, bar: Int }
    type Query {
      getThing(where: WhereInput): String
    }
  `);
  const permissionSDL = `
    schema { query: Query }
    input WhereInput { foo: String, bar: Int }
    type Query {
      getThing(where: WhereInput @preset(value: {foo: null, bar: 1})): String
    }
  `;
  const permissionsSchema = createPermissionsSchema(permissionSDL);
  const argTree = parsePresetArgTreeFromSDL(permissionSDL, introspection);
  const fields = buildRemoteSchemaFieldTree(introspection, permissionsSchema);
  const sdl = composePermissionSDL(fields, argTree);

  expect(sdl).toMatch(/foo:\s*null/);
  expect(sdl).toMatch(/bar:\s*1/);
});
