import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import {
  getColumnInsertOptions,
  getColumnUpdateOptions,
  getCreateRecordFormDefaultValues,
  getEditRecordFormDefaultValues,
  getRecordFormValue,
} from './recordFormValues';

function makeColumn(
  overrides: Partial<DataBrowserColumnMetadata> = {},
): DataBrowserColumnMetadata {
  return {
    id: 'value',
    specificType: 'text',
    baseType: 'text',
    isArray: false,
    displayType: 'text',
    ...overrides,
  };
}

describe('recordFormValues', () => {
  describe('getRecordFormValue', () => {
    it('normalizes boolean values to select values', () => {
      const column = makeColumn({ baseType: 'boolean', isNullable: true });

      expect(getRecordFormValue(column, true)).toBe('true');
      expect(getRecordFormValue(column, false)).toBe('false');
      expect(getRecordFormValue(column, null)).toBe('null');
      expect(getRecordFormValue(column, POSTGRES_DEFAULT_PLACEHOLDER)).toBe(
        POSTGRES_DEFAULT_PLACEHOLDER,
      );
    });

    it('stringifies GeoJSON read from geometry columns for editing', () => {
      const column = makeColumn({
        baseType: 'geometry',
        displayType: 'geometry(Point,4326)',
      });
      const point = { type: 'Point', coordinates: [1, 2] };

      expect(getRecordFormValue(column, point)).toBe(
        JSON.stringify(point, null, 2),
      );
    });

    it('leaves EWKT read from spatial columns untouched', () => {
      const column = makeColumn({ baseType: 'geography' });
      const ewkt = 'SRID=4326;CIRCULARSTRING(0 0,1 1,2 0)';

      expect(getRecordFormValue(column, ewkt)).toBe(ewkt);
    });

    it('stringifies JSON objects for editing', () => {
      const column = makeColumn({ baseType: 'jsonb', displayType: 'jsonb' });

      expect(getRecordFormValue(column, { nested: { enabled: true } })).toBe(
        JSON.stringify({ nested: { enabled: true } }, null, 2),
      );
    });
  });

  describe('getCreateRecordFormDefaultValues', () => {
    it('uses initial values when present', () => {
      const columns = [
        makeColumn({ id: 'enabled', baseType: 'boolean', displayType: 'bool' }),
        makeColumn({ id: 'metadata', baseType: 'jsonb', displayType: 'jsonb' }),
      ];

      expect(
        getCreateRecordFormDefaultValues(columns, {
          enabled: true,
          metadata: { role: 'admin' },
        }),
      ).toEqual({
        enabled: 'true',
        metadata: JSON.stringify({ role: 'admin' }, null, 2),
      });
    });

    it('uses the default placeholder for defaulted columns', () => {
      const columns = [
        makeColumn({
          id: 'enabled',
          baseType: 'boolean',
          displayType: 'bool',
          defaultValue: 'false',
        }),
        makeColumn({
          id: 'name',
          defaultValue: "'Untitled'",
        }),
      ];

      expect(getCreateRecordFormDefaultValues(columns)).toEqual({
        enabled: POSTGRES_DEFAULT_PLACEHOLDER,
        name: POSTGRES_DEFAULT_PLACEHOLDER,
      });
    });
  });

  describe('getEditRecordFormDefaultValues', () => {
    it('normalizes row values for editing', () => {
      const columns = [
        makeColumn({ id: 'enabled', baseType: 'boolean', displayType: 'bool' }),
        makeColumn({ id: 'metadata', baseType: 'jsonb', displayType: 'jsonb' }),
      ];

      expect(
        getEditRecordFormDefaultValues(columns, {
          enabled: false,
          metadata: { role: 'user' },
        }),
      ).toEqual({
        enabled: 'false',
        metadata: JSON.stringify({ role: 'user' }, null, 2),
      });
    });
  });

  describe('getColumnInsertOptions', () => {
    it('converts boolean form values to typed submit values', () => {
      const column = makeColumn({ baseType: 'boolean', displayType: 'bool' });

      expect(getColumnInsertOptions(column, 'true')).toEqual({ value: true });
      expect(getColumnInsertOptions(column, 'false')).toEqual({ value: false });
    });

    it('converts canonical null/default form values to fallbacks', () => {
      const column = makeColumn({
        baseType: 'boolean',
        displayType: 'bool',
        isNullable: true,
        defaultValue: 'true',
      });

      expect(getColumnInsertOptions(column, 'null')).toEqual({
        value: null,
        fallbackValue: 'NULL',
      });
      expect(getColumnInsertOptions(makeColumn(), null)).toEqual({
        value: null,
        fallbackValue: 'NULL',
      });
      expect(
        getColumnInsertOptions(column, POSTGRES_DEFAULT_PLACEHOLDER),
      ).toEqual({
        fallbackValue: 'DEFAULT',
      });
    });

    it('passes the PostGIS type along so values are written through PostGIS', () => {
      expect(
        getColumnInsertOptions(
          makeColumn({ baseType: 'geography' }),
          'SRID=4326;POINT(1 2)',
        ),
      ).toEqual({
        value: 'SRID=4326;POINT(1 2)',
        isArray: false,
        spatialType: 'geography',
      });
      expect(
        getColumnInsertOptions(
          makeColumn({ baseType: 'extensions.geometry' }),
          '{"type":"Point","coordinates":[1,2]}',
        ).spatialType,
      ).toBe('geometry');
      expect(getColumnInsertOptions(makeColumn(), 'hello').spatialType).toBe(
        undefined,
      );
    });
  });
});

describe('getColumnUpdateOptions', () => {
  const point = {
    type: 'Point',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    coordinates: [1, 2],
  };
  const geometry = makeColumn({ baseType: 'geometry' });
  const jsonb = makeColumn({ baseType: 'jsonb' });
  const text = makeColumn();

  it.each([
    {
      name: 'unchanged GeoJSON is skipped',
      column: geometry,
      value: JSON.stringify(point, null, 2),
      original: point,
      expected: null,
    },
    {
      name: 'edited GeoJSON is sent as text',
      column: geometry,
      value: '{"type":"Point","coordinates":[3,4]}',
      original: point,
      expected: { value: '{"type":"Point","coordinates":[3,4]}' },
    },
    {
      name: 'WKT replacing GeoJSON is sent as text',
      column: geometry,
      value: 'SRID=4326;POINT(3 4)',
      original: point,
      expected: { value: 'SRID=4326;POINT(3 4)' },
    },
    {
      name: 'unchanged hex EWKB is skipped',
      column: makeColumn({ baseType: 'geography' }),
      value: '0101000020E6100000',
      original: '0101000020E6100000',
      expected: null,
    },
    {
      name: 'unchanged JSON is skipped',
      column: jsonb,
      value: '{\n  "a": 1\n}',
      original: { a: 1 },
      expected: null,
    },
    {
      name: 'edited JSON is sent parsed',
      column: jsonb,
      value: '{"a":2}',
      original: { a: 1 },
      expected: { value: { a: 2 } },
    },
    {
      name: 'unchanged text is skipped',
      column: text,
      value: 'hello',
      original: 'hello',
      expected: null,
    },
    {
      name: 'edited text is sent',
      column: text,
      value: 'world',
      original: 'hello',
      expected: { value: 'world' },
    },
  ])('$name', ({ column, value, original, expected }) => {
    expect(getColumnUpdateOptions(column, { value }, original)).toEqual(
      expected,
    );
  });

  it('resets to DEFAULT', () => {
    expect(
      getColumnUpdateOptions(text, { fallbackValue: 'DEFAULT' }, 'x'),
    ).toEqual({ reset: 'default' });
  });

  it('resets to NULL only when the value was not already null', () => {
    expect(
      getColumnUpdateOptions(text, { value: null, fallbackValue: 'NULL' }, 'x'),
    ).toEqual({ reset: 'null' });
    expect(
      getColumnUpdateOptions(
        text,
        { value: null, fallbackValue: 'NULL' },
        null,
      ),
    ).toBeNull();
  });
});
