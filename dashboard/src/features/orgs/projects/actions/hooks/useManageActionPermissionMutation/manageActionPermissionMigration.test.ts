import { describe, expect, it } from 'vitest';
import { buildManageActionPermissionMigrationRequest } from './manageActionPermissionMigration';

const createStep = {
  type: 'create_action_permission',
  args: {
    action: 'getExchangeRates',
    role: 'user',
    definition: { select: { filter: {} } },
  },
};

const dropStep = {
  type: 'drop_action_permission',
  args: { action: 'getExchangeRates', role: 'user' },
};

describe('buildManageActionPermissionMigrationRequest', () => {
  it('grants a permission up and drops it down', () => {
    const request = buildManageActionPermissionMigrationRequest({
      action: 'getExchangeRates',
      role: 'user',
      type: 'create_action_permission',
    });

    expect(request.name).toBe('save_action_permission_getExchangeRates_user');
    expect(request.up).toEqual([createStep]);
    expect(request.down).toEqual([dropStep]);
  });

  it('drops a permission up and recreates it down', () => {
    const request = buildManageActionPermissionMigrationRequest({
      action: 'getExchangeRates',
      role: 'user',
      type: 'drop_action_permission',
    });

    expect(request.name).toBe('delete_action_permission_getExchangeRates_user');
    expect(request.up).toEqual([dropStep]);
    expect(request.down).toEqual([createStep]);
  });
});
