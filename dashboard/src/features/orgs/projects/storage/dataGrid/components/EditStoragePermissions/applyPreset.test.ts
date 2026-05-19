import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

import applyPreset from './applyPreset';
import type { PermissionPreset } from './types';

function makePreset(overrides?: Partial<PermissionPreset>): PermissionPreset {
  return {
    id: 'preset-1',
    label: 'default',
    group: 'Rules for bucket',
    createNode: () => ({
      type: 'group',
      id: 'preset-node-id',
      operator: '_and',
      children: [
        {
          type: 'condition',
          id: 'cond-1',
          column: 'bucket_id',
          operator: '_eq',
          value: 'default',
        },
      ],
    }),
    ...overrides,
  };
}

describe('applyPreset', () => {
  it('creates a new OR group when currentFilter is null', () => {
    const result = applyPreset(null, makePreset());

    expect(result.type).toBe('group');
    expect(result.operator).toBe('_or');
    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toMatchObject({
      type: 'group',
      id: 'preset-node-id',
      operator: '_and',
    });
  });

  it('creates a new OR group when currentFilter has no children', () => {
    const emptyGroup: GroupNode = {
      type: 'group',
      id: 'existing-id',
      operator: '_implicit',
      children: [],
    };

    const result = applyPreset(emptyGroup, makePreset());

    expect(result.operator).toBe('_or');
    expect(result.id).toBe('existing-id');
    expect(result.children).toHaveLength(1);
  });

  it('appends to existing OR group', () => {
    const orGroup: GroupNode = {
      type: 'group',
      id: 'or-group-id',
      operator: '_or',
      children: [
        {
          type: 'condition',
          id: 'existing-cond',
          column: 'bucket_id',
          operator: '_eq',
          value: 'photos',
        },
      ],
    };

    const result = applyPreset(orGroup, makePreset());

    expect(result.operator).toBe('_or');
    expect(result.id).toBe('or-group-id');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toMatchObject({ id: 'existing-cond' });
    expect(result.children[1]).toMatchObject({ id: 'preset-node-id' });
  });

  it('wraps non-OR group and preset in a new OR group', () => {
    const andGroup: GroupNode = {
      type: 'group',
      id: 'and-group-id',
      operator: '_and',
      children: [
        {
          type: 'condition',
          id: 'cond-a',
          column: 'name',
          operator: '_eq',
          value: 'file.txt',
        },
      ],
    };

    const result = applyPreset(andGroup, makePreset());

    expect(result.operator).toBe('_or');
    expect(result.id).toBe('and-group-id');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toBe(andGroup);
    expect(result.children[1]).toMatchObject({ id: 'preset-node-id' });
  });

  it('wraps _implicit group with children in a new OR group', () => {
    const implicitGroup: GroupNode = {
      type: 'group',
      id: 'impl-id',
      operator: '_implicit',
      children: [
        {
          type: 'condition',
          id: 'cond-x',
          column: 'size',
          operator: '_eq',
          value: '100',
        },
      ],
    };

    const result = applyPreset(implicitGroup, makePreset());

    expect(result.operator).toBe('_or');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toBe(implicitGroup);
  });

  it('does not mutate the original OR group', () => {
    const orGroup: GroupNode = {
      type: 'group',
      id: 'or-id',
      operator: '_or',
      children: [
        {
          type: 'condition',
          id: 'c1',
          column: 'id',
          operator: '_eq',
          value: '1',
        },
      ],
    };

    const childrenBefore = [...orGroup.children];
    applyPreset(orGroup, makePreset());

    expect(orGroup.children).toEqual(childrenBefore);
    expect(orGroup.children).toHaveLength(1);
  });

  it('uses the preset createNode return value as-is', () => {
    const customNode = {
      type: 'group' as const,
      id: 'custom-node',
      operator: '_and' as const,
      children: [
        {
          type: 'condition' as const,
          id: 'c1',
          column: 'uploaded_by_user_id',
          operator: '_eq' as const,
          value: 'X-Hasura-User-Id',
        },
        {
          type: 'condition' as const,
          id: 'c2',
          column: 'bucket_id',
          operator: '_eq' as const,
          value: 'avatars',
        },
      ],
    };

    const preset = makePreset({ createNode: () => customNode });
    const result = applyPreset(null, preset);

    expect(result.children[0]).toBe(customNode);
  });
});
