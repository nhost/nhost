import { describe, expect, it } from 'vitest';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';
import { buildDeleteActionMigrationRequest } from './deleteActionMigration';

const action: ActionItem = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com',
    output_type: 'ExchangeRatesOutput',
    type: 'query',
    arguments: [{ name: 'base', type: 'String!' }],
  },
  comment: 'Retrieves the exchange rate of a given currency',
};

describe('buildDeleteActionMigrationRequest', () => {
  it('names the migration after the action', () => {
    const request = buildDeleteActionMigrationRequest({ action });

    expect(request.name).toBe('delete_action_getExchangeRates');
    expect(request.datasource).toBe('default');
    expect(request.skip_execution).toBe(false);
  });

  it('drops the action on the way up', () => {
    const request = buildDeleteActionMigrationRequest({ action });

    expect(request.up).toEqual([
      { type: 'drop_action', args: { name: 'getExchangeRates' } },
    ]);
  });

  it('recreates the action on the way down', () => {
    const request = buildDeleteActionMigrationRequest({ action });

    expect(request.down).toEqual([
      {
        type: 'create_action',
        args: {
          name: 'getExchangeRates',
          definition: action.definition,
          comment: 'Retrieves the exchange rate of a given currency',
        },
      },
    ]);
  });

  it('omits the comment when the action has none', () => {
    const { comment, ...actionWithoutComment } = action;
    const request = buildDeleteActionMigrationRequest({
      action: actionWithoutComment,
    });

    expect(request.down?.[0]).toEqual({
      type: 'create_action',
      args: { name: 'getExchangeRates', definition: action.definition },
    });
  });
});
