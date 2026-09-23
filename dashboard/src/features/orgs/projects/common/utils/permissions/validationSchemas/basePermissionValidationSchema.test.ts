import { filterValidationSchema } from '@/features/orgs/projects/common/utils/permissions/validationSchemas/basePermissionValidationSchema';
import type {
  ConditionNode,
  ExistsNode,
  GroupNode,
  InvalidNode,
  RelationshipNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils/types';

function condition(overrides?: Partial<ConditionNode>): ConditionNode {
  return {
    type: 'condition',
    id: 'c1',
    column: 'id',
    operator: '_eq',
    value: 'test',
    ...overrides,
  };
}

function group(
  operator: GroupNode['operator'],
  children: GroupNode['children'],
  id = 'g1',
): GroupNode {
  return { type: 'group', id, operator, children };
}

describe('filterValidationSchema', () => {
  it('accepts null filter', async () => {
    await expect(filterValidationSchema.validate(null)).resolves.toBeNull();
  });

  it('accepts a valid simple condition group', async () => {
    const filter = group('_implicit', [condition()]);
    await expect(
      filterValidationSchema.validate(filter),
    ).resolves.toBeDefined();
  });

  it('accepts a valid _and group', async () => {
    const filter = group('_and', [
      condition({ id: 'c1', column: 'id' }),
      condition({ id: 'c2', column: 'name' }),
    ]);
    await expect(
      filterValidationSchema.validate(filter),
    ).resolves.toBeDefined();
  });

  describe('condition node validation', () => {
    it('rejects condition with missing column', async () => {
      const filter = group('_implicit', [
        {
          type: 'condition',
          id: 'c1',
          column: null,
          operator: '_eq',
          value: 'x',
        } as unknown as ConditionNode,
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        'Please select a column',
      );
    });

    it('rejects condition with missing operator', async () => {
      const filter = group('_implicit', [
        {
          type: 'condition',
          id: 'c1',
          column: 'id',
          operator: null,
          value: 'x',
        } as unknown as ConditionNode,
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        'Please select an operator',
      );
    });

    it('rejects condition with missing value', async () => {
      const filter = group('_implicit', [
        {
          type: 'condition',
          id: 'c1',
          column: 'id',
          operator: '_eq',
          value: null,
        } as unknown as ConditionNode,
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        'Please enter a value',
      );
    });

    it('accepts array of strings as value', async () => {
      const filter = group('_implicit', [
        condition({ value: ['a', 'b', 'c'] }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('accepts numeric scalar value', async () => {
      const filter = group('_implicit', [
        condition({ value: 211 as unknown as string }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('accepts boolean scalar value', async () => {
      const filter = group('_implicit', [
        condition({ value: true as unknown as string }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('accepts array of numbers as value', async () => {
      const filter = group('_implicit', [
        condition({ value: [1, 2] as unknown as string }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('rejects array containing objects', async () => {
      const filter = group('_implicit', [
        condition({ value: [{ a: 1 }] as unknown as string }),
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        'Please enter a valid value',
      );
    });
  });

  describe('serialization collision detection', () => {
    it('rejects duplicate column+operator in _implicit group', async () => {
      const filter = group('_implicit', [
        condition({
          id: 'c1',
          column: 'bucket_id',
          operator: '_eq',
          value: 'a',
        }),
        condition({
          id: 'c2',
          column: 'bucket_id',
          operator: '_eq',
          value: 'b',
        }),
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /bucket_id.*appears more than once/,
      );
    });

    it('allows same column with different operators in _implicit group', async () => {
      const filter = group('_implicit', [
        condition({ id: 'c1', column: 'size', operator: '_gt', value: '10' }),
        condition({ id: 'c2', column: 'size', operator: '_lt', value: '1000' }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('allows duplicate column+operator in _and group (not flat)', async () => {
      const filter = group('_and', [
        condition({
          id: 'c1',
          column: 'bucket_id',
          operator: '_eq',
          value: 'a',
        }),
        condition({
          id: 'c2',
          column: 'bucket_id',
          operator: '_eq',
          value: 'b',
        }),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('rejects multiple _or groups at same level in _implicit group', async () => {
      const filter = group('_implicit', [
        group('_or', [condition({ id: 'c1' })], 'g1'),
        group('_or', [condition({ id: 'c2' })], 'g2'),
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /Multiple "_or" groups/,
      );
    });

    it('rejects multiple _and groups at same level in _implicit group', async () => {
      const filter = group('_implicit', [
        group('_and', [condition({ id: 'c1' })], 'g1'),
        group('_and', [condition({ id: 'c2' })], 'g2'),
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /Multiple "_and" groups/,
      );
    });

    it('allows different logical operators at same level', async () => {
      const filter = group('_implicit', [
        group('_or', [condition({ id: 'c1' })], 'g1'),
        group('_and', [condition({ id: 'c2' })], 'g2'),
      ]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('rejects multiple _exists at same level in _implicit group', async () => {
      const exists1: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: 'users',
        where: group('_implicit', [condition({ id: 'c1' })]),
      };
      const exists2: ExistsNode = {
        type: 'exists',
        id: 'e2',
        schema: 'public',
        table: 'files',
        where: group('_implicit', [condition({ id: 'c2' })]),
      };
      const filter = group('_implicit', [exists1, exists2]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /Multiple "_exists" conditions/,
      );
    });

    it('rejects multiple conditions on same relationship in _implicit group', async () => {
      const rel1: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_implicit', [condition({ id: 'c1', column: 'id' })]),
      };
      const rel2: RelationshipNode = {
        type: 'relationship',
        id: 'r2',
        relationship: 'author',
        child: group('_implicit', [condition({ id: 'c2', column: 'name' })]),
      };
      const filter = group('_implicit', [rel1, rel2]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /Multiple conditions on relationship "author"/,
      );
    });

    it('allows different relationships at same level', async () => {
      const rel1: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_implicit', [condition({ id: 'c1' })]),
      };
      const rel2: RelationshipNode = {
        type: 'relationship',
        id: 'r2',
        relationship: 'category',
        child: group('_implicit', [condition({ id: 'c2' })]),
      };
      const filter = group('_implicit', [rel1, rel2]);
      await expect(
        filterValidationSchema.validate(filter),
      ).resolves.toBeDefined();
    });

    it('detects collision in nested groups', async () => {
      const inner = group('_implicit', [
        condition({ id: 'c1', column: 'id', operator: '_eq', value: '1' }),
        condition({ id: 'c2', column: 'id', operator: '_eq', value: '2' }),
      ]);
      const filter = group('_and', [inner]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /id.*appears more than once/,
      );
    });

    it('detects collision inside _exists where clause', async () => {
      const exists: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: 'users',
        where: group('_implicit', [
          condition({ id: 'c1', column: 'email', operator: '_eq', value: 'a' }),
          condition({ id: 'c2', column: 'email', operator: '_eq', value: 'b' }),
        ]),
      };
      const filter = group('_and', [exists]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /email.*appears more than once/,
      );
    });

    it('detects collision inside relationship child', async () => {
      const rel: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_implicit', [
          condition({ id: 'c1', column: 'name', operator: '_eq', value: 'a' }),
          condition({ id: 'c2', column: 'name', operator: '_eq', value: 'b' }),
        ]),
      };
      const filter = group('_and', [rel]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /name.*appears more than once/,
      );
    });
  });

  describe('non-empty group validation', () => {
    it('rejects empty root filter', async () => {
      const filter = group('_implicit', []);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one rule/,
      );
    });

    it('rejects root containing only an empty nested group', async () => {
      const filter = group('_implicit', [group('_and', [], 'g2')]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one rule/,
      );
    });

    it('rejects an empty AND group beside a valid condition', async () => {
      const filter = group('_or', [group('_and', [], 'g2'), condition()]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('rejects an empty OR group beside a valid condition', async () => {
      const filter = group('_or', [group('_or', [], 'g2'), condition()]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('rejects an empty NOT group beside a valid condition', async () => {
      const filter = group('_or', [group('_not', [], 'g2'), condition()]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('rejects an empty implicit group beside a valid condition', async () => {
      const filter = group('_or', [group('_implicit', [], 'g2'), condition()]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('reports the path of a deeply nested empty group', async () => {
      const filter = group('_or', [
        condition(),
        group('_and', [group('_not', [group('_or', [], 'g4')], 'g3')], 'g2'),
      ]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[1].children[0].children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('rejects an empty nested group beside a valid condition inside exists', async () => {
      const exists: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: 'users',
        where: group('_or', [group('_and', [], 'g3'), condition()], 'g2'),
      };
      const filter = group('_implicit', [exists]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].where.children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('rejects an empty nested group beside a valid condition inside a relationship', async () => {
      const relationship: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_or', [group('_and', [], 'g3'), condition()], 'g2'),
      };
      const filter = group('_implicit', [relationship]);

      await expect(
        filterValidationSchema.validate(filter),
      ).rejects.toMatchObject({
        path: 'children[0].child.children[0].children',
        message: 'Add a condition or remove this empty group.',
      });
    });

    it('accepts completed nested boolean groups', async () => {
      const filter = group('_or', [
        group('_and', [condition()], 'g2'),
        group('_not', [condition({ id: 'c2', column: 'name' })], 'g3'),
      ]);

      await expect(filterValidationSchema.validate(filter)).resolves.toEqual(
        filter,
      );
    });

    it('rejects exists with empty where', async () => {
      const exists: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: 'users',
        where: group('_implicit', []),
      };
      const filter = group('_implicit', [exists]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one condition inside the exists block/,
      );
    });

    it('rejects exists where that only contains an empty nested group', async () => {
      const exists: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: 'users',
        where: group('_implicit', [group('_and', [], 'g2')]),
      };
      const filter = group('_implicit', [exists]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one condition inside the exists block/,
      );
    });

    it('rejects exists with missing table', async () => {
      const exists: ExistsNode = {
        type: 'exists',
        id: 'e1',
        schema: 'public',
        table: '',
        where: group('_implicit', [condition()]),
      };
      const filter = group('_implicit', [exists]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /Please select a table/,
      );
    });

    it('rejects relationship with empty child', async () => {
      const rel: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_implicit', []),
      };
      const filter = group('_implicit', [rel]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one condition inside the relationship block/,
      );
    });

    it('rejects relationship child that only contains an empty nested group', async () => {
      const rel: RelationshipNode = {
        type: 'relationship',
        id: 'r1',
        relationship: 'author',
        child: group('_implicit', [group('_and', [], 'g2')]),
      };
      const filter = group('_implicit', [rel]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /at least one condition inside the relationship block/,
      );
    });
  });

  describe('invalid node validation', () => {
    it('rejects invalid node with reason "primitive"', async () => {
      const invalid: InvalidNode = {
        type: 'invalid',
        id: 'i1',
        reason: 'primitive',
        key: 'user_id',
        raw: 5,
      };
      const filter = group('_implicit', [invalid]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /"user_id" has a primitive value/,
      );
    });

    it('rejects invalid node with reason "operator"', async () => {
      const invalid: InvalidNode = {
        type: 'invalid',
        id: 'i1',
        reason: 'operator',
        key: '_ad',
        raw: [],
      };
      const filter = group('_implicit', [invalid]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /"_ad" is not a valid operator/,
      );
    });
  });

  describe('serialization collision detection (continued)', () => {
    it('detects collision in _not group with multiple children', async () => {
      const filter = group('_not', [
        condition({ id: 'c1', column: 'status', operator: '_eq', value: 'a' }),
        condition({ id: 'c2', column: 'status', operator: '_eq', value: 'b' }),
      ]);
      await expect(filterValidationSchema.validate(filter)).rejects.toThrow(
        /status.*appears more than once/,
      );
    });
  });
});
