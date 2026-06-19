import { describe, expect, it } from 'vitest';
import type {
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import { buildCreateActionMigrationRequest } from './createActionMigration';

const args: CreateActionArgs = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com',
    output_type: 'ExchangeRatesOutput',
    type: 'query',
    arguments: [{ name: 'base', type: 'String!' }],
  },
  comment: 'Retrieves the exchange rate of a given currency',
};

const customTypes: CustomTypes = {
  objects: [
    {
      name: 'ExchangeRatesOutput',
      fields: [{ name: 'base', type: 'String!' }],
    },
  ],
};

const previousCustomTypes: CustomTypes = {
  objects: [],
};

describe('buildCreateActionMigrationRequest', () => {
  it('names the migration after the action', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.name).toBe('create_action_getExchangeRates');
    expect(request.datasource).toBe('default');
    expect(request.skip_execution).toBe(false);
  });

  it('sets the custom types then creates the action on the way up', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
      { type: 'create_action', args },
    ]);
  });

  it('drops the action then restores the previous custom types on the way down', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.down).toEqual([
      { type: 'drop_action', args: { name: 'getExchangeRates' } },
      { type: 'set_custom_types', args: previousCustomTypes },
    ]);
  });
});
