import type {
  DataGridFilter,
  DataGridFilterOperator,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { filtersToFilesWhere } from '@/features/orgs/projects/storage/dataGrid/utils/filtersToFilesWhere';

const bucketId = 'bucket-123';

function makeFilter(overrides: Omit<DataGridFilter, 'id'>): DataGridFilter {
  return { id: 'filter-1', ...overrides };
}

describe('filtersToFilesWhere', () => {
  it('returns only the bucket filter when no filters are provided', () => {
    expect(filtersToFilesWhere([], bucketId)).toEqual({
      bucketId: { _eq: bucketId },
    });
  });

  it('builds a single equality filter', () => {
    const result = filtersToFilesWhere(
      [makeFilter({ column: 'name', op: '=', value: 'test.png' })],
      bucketId,
    );

    expect(result).toEqual({
      _and: [{ bucketId: { _eq: bucketId } }, { name: { _eq: 'test.png' } }],
    });
  });

  it('combines multiple filters into _and array', () => {
    const result = filtersToFilesWhere(
      [
        makeFilter({ column: 'name', op: '=', value: 'test.png' }),
        makeFilter({ column: 'size', op: '>', value: '1000' }),
      ],
      bucketId,
    );

    expect(result).toEqual({
      _and: [
        { bucketId: { _eq: bucketId } },
        { name: { _eq: 'test.png' } },
        { size: { _gt: '1000' } },
      ],
    });
  });

  describe('comparison operators', () => {
    it.each<[DataGridFilterOperator, string]>([
      ['<>', '_neq'],
      ['>', '_gt'],
      ['<', '_lt'],
      ['>=', '_gte'],
      ['<=', '_lte'],
      ['LIKE', '_like'],
      ['NOT LIKE', '_nlike'],
      ['ILIKE', '_ilike'],
      ['NOT ILIKE', '_nilike'],
      ['SIMILAR TO', '_similar'],
      ['NOT SIMILAR TO', '_nsimilar'],
      ['~', '_regex'],
      ['!~', '_nregex'],
      ['~*', '_iregex'],
      ['!~*', '_niregex'],
    ])('maps "%s" to %s', (op, hasuraOp) => {
      const result = filtersToFilesWhere(
        [makeFilter({ column: 'name', op, value: 'val' })],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { name: { [hasuraOp]: 'val' } },
        ],
      });
    });
  });

  describe('IS / IS NOT (null checks)', () => {
    it('maps IS to _is_null: true', () => {
      const result = filtersToFilesWhere(
        [makeFilter({ column: 'mimeType', op: 'IS', value: 'NULL' })],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { mimeType: { _is_null: true } },
        ],
      });
    });

    it('maps IS NOT to _is_null: false', () => {
      const result = filtersToFilesWhere(
        [makeFilter({ column: 'mimeType', op: 'IS NOT', value: 'NULL' })],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { mimeType: { _is_null: false } },
        ],
      });
    });
  });

  describe('IN / NOT IN', () => {
    it('splits comma-separated values for IN', () => {
      const result = filtersToFilesWhere(
        [
          makeFilter({
            column: 'mimeType',
            op: 'IN',
            value: 'image/png,image/jpeg',
          }),
        ],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { mimeType: { _in: ['image/png', 'image/jpeg'] } },
        ],
      });
    });

    it('splits comma-separated values for NOT IN', () => {
      const result = filtersToFilesWhere(
        [
          makeFilter({
            column: 'mimeType',
            op: 'NOT IN',
            value: 'image/png,image/jpeg',
          }),
        ],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { mimeType: { _nin: ['image/png', 'image/jpeg'] } },
        ],
      });
    });

    it('trims whitespace around IN values', () => {
      const result = filtersToFilesWhere(
        [makeFilter({ column: 'mimeType', op: 'IN', value: ' a , b , c ' })],
        bucketId,
      );

      expect(result).toEqual({
        _and: [
          { bucketId: { _eq: bucketId } },
          { mimeType: { _in: ['a', 'b', 'c'] } },
        ],
      });
    });
  });

  it('produces an empty condition object for an unknown operator', () => {
    const result = filtersToFilesWhere(
      [
        makeFilter({
          column: 'name',
          op: 'INVALID_OP' as DataGridFilterOperator,
          value: 'x',
        }),
      ],
      bucketId,
    );

    expect(result).toEqual({
      _and: [{ bucketId: { _eq: bucketId } }, { name: {} }],
    });
  });
});
