import { describe, expect, it } from 'vitest';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import { buildSetActionRelationshipsMigrationRequest } from './setActionRelationshipsMigration';

const customTypes: CustomTypes = {
  objects: [
    {
      name: 'ExchangeRatesOutput2',
      fields: [{ name: 'base', type: 'String!' }],
      relationships: [
        {
          source: 'default',
          name: 'relationshipName',
          type: 'object',
          remote_table: { schema: 'public', name: 'authors' },
          field_mapping: { base: 'name' },
        },
      ],
    },
  ],
};

const previousCustomTypes: CustomTypes = {
  objects: [
    {
      name: 'ExchangeRatesOutput2',
      fields: [{ name: 'base', type: 'String!' }],
    },
  ],
};

describe('buildSetActionRelationshipsMigrationRequest', () => {
  it('names a saved relationship migration descriptively', () => {
    const request = buildSetActionRelationshipsMigrationRequest({
      customTypes,
      previousCustomTypes,
      relationshipName: 'relationshipName',
      outputTypeName: 'ExchangeRatesOutput2',
      mode: 'save',
    });

    expect(request.name).toBe(
      'save_rel_relationshipName_on_ExchangeRatesOutput2',
    );
  });

  it('names a removed relationship migration descriptively', () => {
    const request = buildSetActionRelationshipsMigrationRequest({
      customTypes: previousCustomTypes,
      previousCustomTypes: customTypes,
      relationshipName: 'relationshipName',
      outputTypeName: 'ExchangeRatesOutput2',
      mode: 'remove',
    });

    expect(request.name).toBe(
      'remove_action_relationship_relationshipName_from_ExchangeRatesOutput2',
    );
  });

  it('sets the new types up and restores the previous types down', () => {
    const request = buildSetActionRelationshipsMigrationRequest({
      customTypes,
      previousCustomTypes,
      relationshipName: 'relationshipName',
      outputTypeName: 'ExchangeRatesOutput2',
      mode: 'save',
    });

    expect(request.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
    ]);
    expect(request.down).toEqual([
      { type: 'set_custom_types', args: previousCustomTypes },
    ]);
  });
});
