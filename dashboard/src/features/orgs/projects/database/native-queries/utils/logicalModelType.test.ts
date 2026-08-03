import {
  formFieldsToLogicalModelFields,
  formTypeToLogicalModelType,
  logicalModelFieldsToForm,
  logicalModelTypeToForm,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import type {
  LogicalModelField,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

const cases: Array<[string, LogicalModelType]> = [
  ['scalar', { scalar: 'uuid', nullable: false }],
  ['logical model', { logical_model: 'author', nullable: true }],
  [
    'array of scalar',
    { array: { scalar: 'text', nullable: true }, nullable: false },
  ],
  [
    'array of logical model',
    {
      array: { logical_model: 'author', nullable: false },
      nullable: true,
    },
  ],
  [
    'nested arrays and nullability',
    {
      array: {
        array: { scalar: 'integer', nullable: false },
        nullable: true,
      },
      nullable: false,
    },
  ],
];

describe('logical model type converters', () => {
  it.each(cases)('round-trips %s', (_name, wireType) => {
    expect(
      formTypeToLogicalModelType(logicalModelTypeToForm(wireType)),
    ).toEqual(wireType);
  });

  it('restores field descriptions as stable form strings', () => {
    const fields: LogicalModelField[] = [
      {
        name: 'id',
        type: { scalar: 'uuid', nullable: false },
        description: '  External description  ',
      },
      { name: 'tags', type: cases[2][1] },
    ];

    expect(logicalModelFieldsToForm(fields)).toEqual([
      {
        name: 'id',
        type: { kind: 'scalar', scalar: 'uuid', nullable: false },
        description: '  External description  ',
      },
      {
        name: 'tags',
        type: {
          kind: 'array',
          item: { kind: 'scalar', scalar: 'text', nullable: true },
          nullable: false,
        },
        description: '',
      },
    ]);
  });

  it('trims field names and descriptions only when serializing', () => {
    expect(
      formFieldsToLogicalModelFields([
        {
          name: '  id  ',
          type: { kind: 'scalar', scalar: 'uuid', nullable: false },
          description: '  Primary identifier  ',
        },
        {
          name: 'empty_description',
          type: {
            kind: 'array',
            item: {
              kind: 'logical_model',
              logicalModel: 'author',
              nullable: true,
            },
            nullable: false,
          },
          description: '   ',
        },
      ]),
    ).toEqual([
      {
        name: 'id',
        type: { scalar: 'uuid', nullable: false },
        description: 'Primary identifier',
      },
      {
        name: 'empty_description',
        type: {
          array: { logical_model: 'author', nullable: true },
          nullable: false,
        },
      },
    ]);
  });
});
