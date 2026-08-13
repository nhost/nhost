import type {
  ActionItem,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import {
  type ActionRelationship,
  buildCustomTypesWithRelationships,
  findOutputObjectType,
  getActionOutputTypeName,
} from './actionRelationships';

const customTypes: CustomTypes = {
  input_objects: [
    {
      name: 'SampleInput',
      fields: [
        { name: 'username', type: 'String!' },
        { name: 'password', type: 'String!' },
      ],
    },
  ],
  objects: [
    {
      name: 'SampleOutput',
      fields: [
        { name: 'accessToken', type: 'String!' },
        { name: 'something', type: 'String' },
      ],
    },
    {
      name: 'ExchangeRatesOutput',
      fields: [
        { name: 'base', type: 'String!' },
        { name: 'lastUpdated', type: 'String!' },
        { name: 'rates', type: 'jsonb!' },
      ],
    },
  ],
};

const relationship: ActionRelationship = {
  source: 'default',
  name: 'animal',
  type: 'object',
  remote_table: { schema: 'public', name: 'animals' },
  field_mapping: { lastUpdated: 'created_at', rates: 'user_id' },
};

function createAction(outputType: string): ActionItem {
  return {
    name: 'getExchangeRates',
    definition: { handler: 'http://localhost', output_type: outputType },
  };
}

describe('getActionOutputTypeName', () => {
  it('unwraps list and non-null wrappers', () => {
    expect(getActionOutputTypeName(createAction('ExchangeRatesOutput'))).toBe(
      'ExchangeRatesOutput',
    );
    expect(
      getActionOutputTypeName(createAction('[ExchangeRatesOutput!]!')),
    ).toBe('ExchangeRatesOutput');
  });
});

describe('findOutputObjectType', () => {
  it('returns the matching object type', () => {
    const objectType = findOutputObjectType(customTypes, 'ExchangeRatesOutput');
    expect(objectType?.name).toBe('ExchangeRatesOutput');
  });

  it('returns null when the output type is not an object type', () => {
    expect(findOutputObjectType(customTypes, 'String')).toBeNull();
  });

  it('does not match input object types by name', () => {
    expect(findOutputObjectType(customTypes, 'SampleInput')).toBeNull();
  });
});

describe('buildCustomTypesWithRelationships', () => {
  it('attaches the relationship to the target output type', () => {
    const result = buildCustomTypesWithRelationships(
      customTypes,
      'ExchangeRatesOutput',
      [relationship],
    );

    expect(
      findOutputObjectType(result, 'ExchangeRatesOutput')?.relationships,
    ).toEqual([relationship]);
  });

  it('preserves other custom types and untouched objects', () => {
    const result = buildCustomTypesWithRelationships(
      customTypes,
      'ExchangeRatesOutput',
      [relationship],
    );

    expect(result.input_objects).toEqual(customTypes.input_objects);

    const untouched = result.objects?.find(
      (object) => object.name === 'SampleOutput',
    );
    expect(untouched?.relationships).toBeUndefined();
  });

  it('replaces an existing relationship when its type changes', () => {
    const withObject = buildCustomTypesWithRelationships(
      customTypes,
      'ExchangeRatesOutput',
      [relationship],
    );
    const arrayRelationship: ActionRelationship = {
      ...relationship,
      type: 'array',
    };
    const withArray = buildCustomTypesWithRelationships(
      withObject,
      'ExchangeRatesOutput',
      [arrayRelationship],
    );

    expect(
      findOutputObjectType(withArray, 'ExchangeRatesOutput')?.relationships,
    ).toEqual([arrayRelationship]);
  });

  it('drops the relationships key entirely when the list is empty', () => {
    const withObject = buildCustomTypesWithRelationships(
      customTypes,
      'ExchangeRatesOutput',
      [relationship],
    );
    const removed = buildCustomTypesWithRelationships(
      withObject,
      'ExchangeRatesOutput',
      [],
    );

    const target = removed.objects?.find(
      (object) => object.name === 'ExchangeRatesOutput',
    );
    expect(target).toBeDefined();
    expect(target && 'relationships' in target).toBe(false);
  });
});
