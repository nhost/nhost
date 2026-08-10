import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import {
  getColumnInsertOptions,
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
  });
});
