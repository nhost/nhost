import { describe, expect, it } from 'vitest';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import type { ClientCustomType } from './customTypesUtils';
import {
  getActionTypes,
  hydrateTypeRelationships,
  mergeCustomTypes,
  parseCustomTypes,
  reformCustomTypes,
} from './customTypesUtils';

const serverCustomTypes: CustomTypes = {
  scalars: [{ name: 'SpecialDate' }],
  enums: [{ name: 'Color', values: [{ value: 'RED' }] }],
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
      fields: [{ name: 'accessToken', type: 'String!' }],
      relationships: [{
          name: 'user',
          type: 'object',
          remote_table: { schema: 'public', name: 'users' },
          field_mapping: { userId: 'id' },
        }],
    },
  ],
};

describe('parseCustomTypes', () => {
  it('flattens server custom types into a list with kinds', () => {
    expect(parseCustomTypes(serverCustomTypes)).toEqual([
      { kind: 'scalar', name: 'SpecialDate' },
      { kind: 'enum', name: 'Color', values: [{ value: 'RED' }] },
      {
        kind: 'input_object',
        name: 'SampleInput',
        fields: [
          { name: 'username', type: 'String!' },
          { name: 'password', type: 'String!' },
        ],
      },
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'accessToken', type: 'String!' }],
        relationships: [{
          name: 'user',
          type: 'object',
          remote_table: { schema: 'public', name: 'users' },
          field_mapping: { userId: 'id' },
        }],
      },
    ]);
  });

  it('handles missing groups', () => {
    expect(parseCustomTypes({})).toEqual([]);
  });
});

describe('reformCustomTypes', () => {
  it('round-trips with parseCustomTypes', () => {
    expect(reformCustomTypes(parseCustomTypes(serverCustomTypes))).toEqual(
      serverCustomTypes,
    );
  });

  it('always returns all four groups', () => {
    expect(reformCustomTypes([])).toEqual({
      scalars: [],
      enums: [],
      input_objects: [],
      objects: [],
    });
  });
});

describe('mergeCustomTypes', () => {
  it('replaces same-name types and appends new ones', () => {
    const existingTypes = parseCustomTypes(serverCustomTypes);
    const newTypes: ClientCustomType[] = [
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'refreshToken', type: 'String!' }],
      },
      {
        kind: 'object',
        name: 'OtherOutput',
        fields: [{ name: 'id', type: 'ID!' }],
      },
    ];

    const { types, overlappingTypenames } = mergeCustomTypes(
      newTypes,
      existingTypes,
    );

    expect(overlappingTypenames).toEqual(['SampleOutput']);
    expect(types).toHaveLength(existingTypes.length + 1);
    expect(types.find((type) => type.name === 'SampleOutput')).toEqual(
      newTypes[0],
    );
    expect(types.at(-1)).toEqual(newTypes[1]);
  });
});

describe('hydrateTypeRelationships', () => {
  it('preserves relationships of existing object types', () => {
    const existingTypes = parseCustomTypes(serverCustomTypes);
    const newTypes: ClientCustomType[] = [
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'accessToken', type: 'String!' }],
      },
    ];

    expect(hydrateTypeRelationships(newTypes, existingTypes)).toEqual([
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'accessToken', type: 'String!' }],
        relationships: [{
          name: 'user',
          type: 'object',
          remote_table: { schema: 'public', name: 'users' },
          field_mapping: { userId: 'id' },
        }],
      },
    ]);
  });

  it('leaves types without existing relationships untouched', () => {
    const newTypes: ClientCustomType[] = [
      {
        kind: 'object',
        name: 'BrandNewOutput',
        fields: [{ name: 'id', type: 'ID!' }],
      },
    ];

    expect(hydrateTypeRelationships(newTypes, [])).toEqual(newTypes);
  });
});

describe('getActionTypes', () => {
  const allTypes: ClientCustomType[] = [
    {
      kind: 'input_object',
      name: 'SampleInput',
      fields: [
        { name: 'username', type: 'String!' },
        { name: 'filter', type: '[NestedInput!]' },
      ],
    },
    {
      kind: 'input_object',
      name: 'NestedInput',
      fields: [{ name: 'date', type: 'SpecialDate' }],
    },
    { kind: 'scalar', name: 'SpecialDate' },
    {
      kind: 'object',
      name: 'SampleOutput',
      fields: [{ name: 'color', type: 'Color!' }],
    },
    { kind: 'enum', name: 'Color', values: [{ value: 'RED' }] },
    {
      kind: 'object',
      name: 'UnrelatedOutput',
      fields: [{ name: 'id', type: 'ID!' }],
    },
  ];

  it('collects the types used by an action, following nested fields', () => {
    const actionTypes = getActionTypes(
      {
        arguments: [{ name: 'arg1', type: 'SampleInput!' }],
        output_type: 'SampleOutput',
      },
      allTypes,
    );

    expect(actionTypes.map((type) => type.name)).toEqual([
      'SampleInput',
      'NestedInput',
      'SpecialDate',
      'SampleOutput',
      'Color',
    ]);
  });

  it('ignores built-in and unknown types', () => {
    const actionTypes = getActionTypes(
      {
        arguments: [{ name: 'name', type: 'String!' }],
        output_type: 'UnknownType',
      },
      allTypes,
    );

    expect(actionTypes).toEqual([]);
  });
});
