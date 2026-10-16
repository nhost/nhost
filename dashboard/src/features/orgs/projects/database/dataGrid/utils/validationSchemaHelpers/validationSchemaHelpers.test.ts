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

describe('generated columns', () => {
  it('does not require non-nullable generated columns without defaults', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('text', {
        isNullable: false,
        isGenerated: true,
        defaultValue: null,
      }),
    ]);

    await expect(schema.validate({ col: null })).resolves.toBeTruthy();
  });
});

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
    const schema = createDynamicValidationSchema([
      makeColumn('time without time zone'),
    ]);

    await expect(schema.validate({ col: '14:30' })).resolves.toBeTruthy();
    await expect(schema.validate({ col: '14:30:00' })).resolves.toBeTruthy();
  });

  it('rejects values that are not time strings', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('time without time zone', { isNullable: false }),
    ]);

    await expect(schema.validate({ col: '1 day' })).rejects.toThrow(
      'This is not a valid time',
    );
  });

  it('accepts time zone offsets for time with time zone values', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('time with time zone'),
    ]);

    await expect(schema.validate({ col: '14:30' })).resolves.toBeTruthy();
    await expect(schema.validate({ col: '08:30:00+00' })).resolves.toBeTruthy();
    await expect(
      schema.validate({ col: '08:30:00+00:00' }),
    ).resolves.toBeTruthy();
  });
});

describe('date and timestamp columns', () => {
  it('preserves raw PostgreSQL date and timestamp strings', async () => {
    const timestampSchema = createDynamicValidationSchema([
      makeColumn('timestamp with time zone'),
    ]);
    const dateSchema = createDynamicValidationSchema([makeColumn('date')]);

    await expect(
      timestampSchema.validate({ col: '2024-01-15 10:30:00.123456+02' }),
    ).resolves.toMatchObject({ col: '2024-01-15 10:30:00.123456+02' });
    await expect(
      dateSchema.validate({ col: 'infinity' }),
    ).resolves.toMatchObject({ col: 'infinity' });
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

describe('boolean columns', () => {
  it('accepts the resolver-sanitized default placeholder for defaulted columns', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('boolean', { isNullable: false, defaultValue: 'false' }),
    ]);

    await expect(schema.validate({ col: undefined })).resolves.toBeTruthy();
  });

  it('rejects the null option for non-nullable columns', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('boolean', { isNullable: false, defaultValue: 'false' }),
    ]);

    await expect(schema.validate({ col: 'null' })).rejects.toThrow(
      'This field is required.',
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

describe('PostGIS columns', () => {
  it.each([
    'POINT(1 2)',
    'SRID=4326;POINT(1 2)',
    '{"type":"Point","coordinates":[1,2]}',
    '0101000020E610000000000000000008400000000000001040',
  ])('accepts %s in a geometry column', async (value) => {
    const schema = createDynamicValidationSchema([
      makeColumn('geometry(Point,4326)', { isNullable: false }),
    ]);

    await expect(schema.validate({ col: value })).resolves.toBeTruthy();
  });

  it('rejects text that is not a geometry', async () => {
    const schema = createDynamicValidationSchema([makeColumn('geometry')]);

    await expect(schema.validate({ col: 'somewhere' })).rejects.toThrow(
      'This is not a valid geometry.',
    );
  });

  it('rejects GeoJSON in a geography column', async () => {
    const schema = createDynamicValidationSchema([
      makeColumn('geography(Point,4326)'),
    ]);

    await expect(
      schema.validate({ col: '{"type":"Point","coordinates":[1,2]}' }),
    ).rejects.toThrow('Geography columns do not accept GeoJSON.');
  });

  it('allows empty nullable values', async () => {
    const schema = createDynamicValidationSchema([makeColumn('geometry')]);

    await expect(schema.validate({ col: null })).resolves.toBeTruthy();
  });
});

describe('array columns', () => {
  it.each([
    'integer[]',
    'uuid[]',
    'boolean[]',
    'timestamp with time zone[]',
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
