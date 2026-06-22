import type {
  ActionItem,
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import { buildUpdateActionMigrationRequest } from './updateActionMigration';

const originalAction: ActionItem = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com',
    output_type: 'ExchangeRatesOutput',
    type: 'query',
    arguments: [{ name: 'base', type: 'String!' }],
  },
  comment: 'old comment',
};

const args: CreateActionArgs = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com',
    output_type: 'ExchangeRatesOutput2',
    type: 'query',
    arguments: [{ name: 'base', type: 'String!' }],
  },
  comment: 'new comment',
};

const customTypes: CustomTypes = {
  objects: [{ name: 'ExchangeRatesOutput2', fields: [] }],
};

const previousCustomTypes: CustomTypes = {
  objects: [{ name: 'ExchangeRatesOutput', fields: [] }],
};

describe('buildUpdateActionMigrationRequest', () => {
  it('names the migration from the original to the new action name', () => {
    const request = buildUpdateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
      originalAction,
    });

    expect(request.name).toBe(
      'modify_action_getExchangeRates_to_getExchangeRates',
    );
  });

  it('sets the new custom types then updates the action on the way up', () => {
    const request = buildUpdateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
      originalAction,
    });

    expect(request.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
      { type: 'update_action', args },
    ]);
  });

  it('restores the original action and custom types on the way down', () => {
    const request = buildUpdateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
      originalAction,
    });

    expect(request.down).toEqual([
      {
        type: 'update_action',
        args: {
          name: 'getExchangeRates',
          definition: originalAction.definition,
          comment: 'old comment',
        },
      },
      { type: 'set_custom_types', args: previousCustomTypes },
    ]);
  });

  it('omits the comment in the down migration when the original had none', () => {
    const { comment, ...actionWithoutComment } = originalAction;
    const request = buildUpdateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
      originalAction: actionWithoutComment,
    });

    expect(request.down?.[0]).toEqual({
      type: 'update_action',
      args: {
        name: 'getExchangeRates',
        definition: originalAction.definition,
      },
    });
  });
});
