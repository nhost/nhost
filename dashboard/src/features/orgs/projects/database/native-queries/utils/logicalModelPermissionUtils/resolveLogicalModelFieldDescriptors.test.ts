import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import resolveLogicalModelFieldDescriptors from './resolveLogicalModelFieldDescriptors';

const author: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'bio', type: { scalar: 'character varying', nullable: true } },
    { name: 'metadata', type: { scalar: 'json', nullable: true } },
    {
      name: 'tags',
      type: {
        array: { scalar: 'text', nullable: false },
        nullable: false,
      },
    },
    {
      name: 'profile',
      type: { logical_model: 'profile', nullable: true },
    },
  ],
};

describe('resolveLogicalModelFieldDescriptors', () => {
  it('returns only the model’s own scalar fields', () => {
    expect(resolveLogicalModelFieldDescriptors(author)).toEqual([
      { name: 'id', nullable: false, scalar: 'uuid' },
      { name: 'bio', nullable: true, scalar: 'character varying' },
      { name: 'metadata', nullable: true, scalar: 'json' },
    ]);
  });

  it('skips array and object fields, even when an object has no referenced model', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [
        { name: 'value', type: { scalar: 'text', nullable: false } },
        {
          name: 'tags',
          type: {
            array: { scalar: 'text', nullable: false },
            nullable: false,
          },
        },
        { name: 'missing', type: { logical_model: 'absent', nullable: false } },
      ],
    };

    expect(resolveLogicalModelFieldDescriptors(model)).toEqual([
      { name: 'value', nullable: false, scalar: 'text' },
    ]);
  });

  it('does not traverse references, including cycles', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [
        { name: 'id', type: { scalar: 'integer', nullable: false } },
        { name: 'self', type: { logical_model: 'result', nullable: false } },
      ],
    };

    expect(resolveLogicalModelFieldDescriptors(model)).toEqual([
      { name: 'id', nullable: false, scalar: 'integer' },
    ]);
  });

  it('includes fields with valid leading underscores', () => {
    const model: LogicalModelItem = {
      name: 'result',
      fields: [{ name: '_private', type: { scalar: 'text', nullable: false } }],
    };

    expect(resolveLogicalModelFieldDescriptors(model)).toEqual([
      { name: '_private', nullable: false, scalar: 'text' },
    ]);
  });
});
