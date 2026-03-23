import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { filtersToWhere } from './filtersToWhere';

describe('filtersToWhere', () => {
  describe('empty or null filters', () => {
    it('should return empty string for undefined filters', () => {
      expect(filtersToWhere(undefined)).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(filtersToWhere([])).toBe('');
    });
  });

  describe('comparison operators', () => {
    it('should handle greater than operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'age', op: '>', value: '18', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE age > '18'");
    });

    it('should handle less than operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'price', op: '<', value: '100', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE price < '100'");
    });

    it('should handle greater than or equal operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'score', op: '>=', value: '50', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE score >= '50'");
    });

    it('should handle less than or equal operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'quantity', op: '<=', value: '1000', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE quantity <= '1000'");
    });

    it('should handle equals operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'status', op: '=', value: 'active', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE status = 'active'");
    });

    it('should handle not equals operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'status', op: '<>', value: 'deleted', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE status <> 'deleted'");
    });
  });

  describe('IN operators', () => {
    it('should handle IN operator with multiple values', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'status',
          op: 'IN',
          value: 'active,pending,approved',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE status IN ('active','pending','approved')",
      );
    });

    it('should handle IN operator with single value', () => {
      const filters: DataGridFilter[] = [
        { column: 'id', op: 'IN', value: '1', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE id IN ('1')");
    });

    it('should handle NOT IN operator', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'category',
          op: 'NOT IN',
          value: 'spam,trash',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE category NOT IN ('spam','trash')",
      );
    });

    it('should handle IN operator with numeric values', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'priority',
          op: 'IN',
          value: '1,2,3',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE priority IN ('1','2','3')");
    });
  });

  describe('LIKE operators', () => {
    it('should handle LIKE operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'name', op: 'LIKE', value: '%john%', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE name LIKE '%john%'");
    });

    it('should handle ILIKE operator (case-insensitive)', () => {
      const filters: DataGridFilter[] = [
        { column: 'email', op: 'ILIKE', value: '%@example.com', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE email ILIKE '%@example.com'");
    });
  });

  describe('NULL operators', () => {
    it('should handle IS operator (NULL check)', () => {
      const filters: DataGridFilter[] = [
        { column: 'deleted_at', op: 'IS', value: '', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe('WHERE deleted_at IS NULL');
    });

    it('should handle IS NOT operator (NOT NULL check)', () => {
      const filters: DataGridFilter[] = [
        { column: 'created_at', op: 'IS NOT', value: '', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe('WHERE created_at IS NOT NULL');
    });
  });

  describe('multiple filters', () => {
    it('should combine multiple filters with AND', () => {
      const filters: DataGridFilter[] = [
        { column: 'age', op: '>', value: '18', id: 'id' },
        { column: 'status', op: '=', value: 'active', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE age > '18' AND status = 'active'",
      );
    });

    it('should handle complex combination of different operators', () => {
      const filters: DataGridFilter[] = [
        { column: 'price', op: '>=', value: '100', id: 'id' },
        {
          column: 'category',
          op: 'IN',
          value: 'electronics,books',
          id: 'id',
        },
        { column: 'deleted_at', op: 'IS', value: '', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE price >= '100' AND category IN ('electronics','books') AND deleted_at IS NULL",
      );
    });

    it('should handle multiple filters with various operators', () => {
      const filters: DataGridFilter[] = [
        { column: 'name', op: 'LIKE', value: '%test%', id: 'id' },
        { column: 'score', op: '>', value: '50', id: 'id' },
        { column: 'status', op: '<>', value: 'deleted', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE name LIKE '%test%' AND score > '50' AND status <> 'deleted'",
      );
    });
  });

  describe('JSONB operators', () => {
    it('should handle @> (contains) operator', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'metadata',
          op: '@>',
          value: '{"key": "value"}',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        'WHERE metadata @> \'{"key": "value"}\'::jsonb',
      );
    });

    it('should handle <@ (contained in) operator', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'metadata',
          op: '<@',
          value: '{"key": "value", "other": 123}',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        'WHERE metadata <@ \'{"key": "value", "other": 123}\'::jsonb',
      );
    });

    it('should handle ? (has key) operator', () => {
      const filters: DataGridFilter[] = [
        { column: 'metadata', op: '?', value: 'name', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE metadata ? 'name'");
    });

    it('should handle ?| (has any keys) operator', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'metadata',
          op: '?|',
          value: 'name,email,phone',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE metadata ?| array['name','email','phone']",
      );
    });

    it('should handle ?& (has all keys) operator', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'metadata',
          op: '?&',
          value: 'name,email',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE metadata ?& array['name','email']",
      );
    });

    it('should handle ?| with spaces around commas', () => {
      const filters: DataGridFilter[] = [
        {
          column: 'data',
          op: '?|',
          value: 'key1 , key2 , key3',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE data ?| array['key1','key2','key3']",
      );
    });

    it('should handle @> with empty object', () => {
      const filters: DataGridFilter[] = [
        { column: 'metadata', op: '@>', value: '{}', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE metadata @> '{}'::jsonb");
    });
  });

  describe('invalid operators', () => {
    it('should ignore filters with invalid operators', () => {
      const filters = [
        {
          column: 'name',
          op: 'INVALID_OP' as DataGridFilter['op'],
          value: '',
          id: 'id',
        },
      ];
      expect(filtersToWhere(filters)).toBe('');
    });

    it('should keep valid filters and discard invalid ones', () => {
      const filters = [
        { column: 'age', op: '>' as const, value: '18', id: 'id1' },
        {
          column: 'name',
          op: 'NOT_A_REAL_OP' as DataGridFilter['op'],
          value: '',
          id: 'id2',
        },
        { column: 'status', op: '=' as const, value: 'active', id: 'id3' },
      ];
      expect(filtersToWhere(filters)).toBe(
        "WHERE age > '18' AND status = 'active'",
      );
    });
  });

  describe('edge cases', () => {
    it('should handle IN with empty array', () => {
      const filters: DataGridFilter[] = [
        { column: 'status', op: 'IN', value: '', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toBe("WHERE status IN ('')");
    });

    it('should handle special characters in column names', () => {
      const filters: DataGridFilter[] = [
        { column: 'column-with-dash', op: '=', value: 'test', id: 'id' },
        { column: 'myFancyColumn', op: '=', value: 'no-test', id: 'id' },
      ];
      expect(filtersToWhere(filters)).toContain('"column-with-dash"');
      expect(filtersToWhere(filters)).toContain('"myFancyColumn"');
    });
  });
});
