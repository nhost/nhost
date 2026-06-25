import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser/dataBrowser';
import { getBaseType } from '@/features/orgs/projects/database/dataGrid/utils/getBaseType';
import { isArray } from '@/features/orgs/projects/database/dataGrid/utils/isArray';
import { createDynamicValidationSchema } from './validationSchemaHelpers';

function makeColumn(
  specificType: string,
  overrides: Partial<DataBrowserColumnMetadata> = {},
): DataBrowserColumnMetadata {
  return {
    id: 'col',
    specificType,
    baseType: getBaseType(specificType),
    isArray: isArray(specificType),
    displayType: specificType,
    isNullable: true,
    isIdentity: false,
    isEditable: true,
    isPrimary: false,
    isUnique: false,
    isGenerated: false,
    generationExpression: null,
    defaultValue: null,
    isDefaultValueCustom: false,
    comment: null,
    uniqueConstraints: [],
    primaryConstraints: [],
    foreignKeyRelation: null,
    ...overrides,
  } as DataBrowserColumnMetadata;
}

describe('interval columns', () => {
  it('accepts valid PostgreSQL interval syntax', async () => {
    const schema = createDynamicValidationSchema([makeColumn('interval')]);

    await expect(schema.validate({ col: '1 day' })).resolves.toBeTruthy();
    await expect(
      schema.validate({ col: '2 hours 30 minutes' }),
    ).resolves.toBeTruthy();
    await expect(schema.validate({ col: '-3 days' })).resolves.toBeTruthy();
    await expect(schema.validate({ col: '1 mon' })).resolves.toBeTruthy();
    await expect(schema.validate({ col: '01:30:00' })).resolves.toBeTruthy();
  });
});

describe('time columns', () => {
  it('accepts HH:MM and HH:MM:SS', async () => {
    const schema = createDynamicValidationSchema([makeColumn('time')]);

    await expect(schema.validate({ col: '14:30' })).resolves.toBeTruthy();
    await expect(schema.validate({ col: '14:30:00' })).resolves.toBeTruthy();
  });

  it('rejects values that are not time strings', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('time', { isNullable: false }),
    ]);

    await expect(schema.validate({ col: '1 day' })).rejects.toThrow(
      'This is not a valid time',
    );
  });

  it('applies to timetz too', async () => {
    const schema = createDynamicValidationSchema([makeColumn('timetz')]);

    await expect(schema.validate({ col: '14:30' })).resolves.toBeTruthy();
  });
});

describe('timestamp columns', () => {
  it('accepts a date value', async () => {
    const schema = createDynamicValidationSchema([makeColumn('timestamptz')]);

    await expect(
      schema.validate({ col: new Date('2024-01-15') }),
    ).resolves.toBeTruthy();
  });
});

describe('uuid columns', () => {
  it('rejects a non-UUID string', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('uuid', { isNullable: false }),
    ]);

    await expect(schema.validate({ col: 'not-a-uuid' })).rejects.toThrow(
      'This is not a valid UUID.',
    );
  });
});

describe('json/jsonb columns', () => {
  it('rejects invalid JSON', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('jsonb', { isNullable: false }),
    ]);

    await expect(schema.validate({ col: '{bad json' })).rejects.toThrow(
      'This is not a valid JSON.',
    );
  });
});

describe('array columns', () => {
  it.each([
    'integer[]',
    'uuid[]',
    'boolean[]',
    'timestamptz[]',
    'text[]',
  ])('treats %s as free text, not its scalar element', async (specificType) => {
    const schema = createDynamicValidationSchema([makeColumn(specificType)]);

    await expect(schema.validate({ col: '[1, 2, 3]' })).resolves.toBeTruthy();
  });

  it('does not apply scalar uuid validation to a uuid[] value', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('uuid[]', { isNullable: false }),
    ]);

    await expect(
      schema.validate({ col: '["not-a-uuid"]' }),
    ).resolves.toBeTruthy();
  });
});
