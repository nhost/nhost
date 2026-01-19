import type { SortingRule } from 'react-table';
import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { createTableQueryKey } from './createTableQueryKey';

describe('createTableQueryKey', () => {
  const tablePath = 'users';
  const offset = 0;

  describe('sorting', () => {
    it('should create query key with default sort when sortBy is empty', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'no-filter']);
    });

    it('should create query key with ascending sort', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [{ id: 'name', desc: false }];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'name.false', 'no-filter']);
    });

    it('should create query key with descending sort', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [{ id: 'age', desc: true }];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'age.true', 'no-filter']);
    });

    it('should only use first sort rule when multiple are provided', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [
        { id: 'name', desc: false },
        { id: 'age', desc: true },
      ];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'name.false', 'no-filter']);
    });
  });

  describe('filters', () => {
    it('should create query key with no filters', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'no-filter']);
    });

    it('should create query key with single filter', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        { column: 'status', op: '=', value: 'active', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'status-=-active']);
    });

    it('should create query key with multiple filters', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        { column: 'status', op: '=', value: 'active', id: 'id' },
        { column: 'age', op: '>', value: '18', id: 'id' },
        { column: 'country', op: '=', value: 'US', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual([
        'users',
        0,
        'default-order',
        'status-=-activeage->-18country-=-US',
      ]);
    });

    it('should handle filters with different operators', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        { column: 'price', op: '>=', value: '100', id: 'id' },
        { column: 'name', op: 'LIKE', value: 'John%', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual([
        'users',
        0,
        'default-order',
        'price->=-100name-LIKE-John%',
      ]);
    });

    it('should handle undefined filters', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const filters = undefined as any;

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'no-filter']);
    });

    it('should handle null filters', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const filters = null as any;

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'no-filter']);
    });
  });

  describe('combined sorting and filtering', () => {
    it('should create query key with both sort and filter', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [{ id: 'created_at', desc: true }];
      const filters: DataGridFilter[] = [
        { column: 'status', op: '=', value: 'active', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual([
        'users',
        0,
        'created_at.true',
        'status-=-active',
      ]);
    });

    it('should create query key with sort and multiple filters', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [{ id: 'name', desc: false }];
      const filters: DataGridFilter[] = [
        { column: 'status', op: '=', value: 'active', id: 'id' },
        { column: 'role', op: 'IN', value: 'admin,user', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual([
        'users',
        0,
        'name.false',
        'status-=-activerole-IN-admin,user',
      ]);
    });
  });

  describe('tablePath and offset', () => {
    it('should handle different table paths', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey('orders', offset, sortBy, filters);

      expect(result).toEqual(['orders', 0, 'default-order', 'no-filter']);
    });

    it('should handle different offsets', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [];

      const result1 = createTableQueryKey(tablePath, 0, sortBy, filters);
      const result2 = createTableQueryKey(tablePath, 50, sortBy, filters);
      const result3 = createTableQueryKey(tablePath, 100, sortBy, filters);

      expect(result1).toEqual(['users', 0, 'default-order', 'no-filter']);
      expect(result2).toEqual(['users', 50, 'default-order', 'no-filter']);
      expect(result3).toEqual(['users', 100, 'default-order', 'no-filter']);
    });

    it('should handle nested table paths', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [];

      const result = createTableQueryKey(
        'public.users',
        offset,
        sortBy,
        filters,
      );

      expect(result).toEqual(['public.users', 0, 'default-order', 'no-filter']);
    });

    it('should handle special characters in filter values', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        { column: 'email', op: '=', value: 'user@example.com', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual([
        'users',
        0,
        'default-order',
        'email-=-user@example.com',
      ]);
    });

    it('should handle numeric filter values', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        // biome-ignore lint/suspicious/noExplicitAny: test file
        { column: 'age', op: '=', value: 25 as any, id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'age-=-25']);
    });

    it('should handle empty string filter values', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test file
      const sortBy: SortingRule<any>[] = [];
      const filters: DataGridFilter[] = [
        { column: 'description', op: '=', value: '', id: 'id' },
      ];

      const result = createTableQueryKey(tablePath, offset, sortBy, filters);

      expect(result).toEqual(['users', 0, 'default-order', 'description-=-']);
    });
  });
});
