import {
  createEmptyTypeNode,
  formFieldsToLogicalModelFields,
  formTypeToLogicalModelType,
  type LogicalModelTypeNode,
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
  it('creates non-nullable empty scalar nodes', () => {
    expect(createEmptyTypeNode()).toEqual({
      kind: 'scalar',
      scalar: '',
      nullable: false,
    });
  });

  it.each(cases)('round-trips %s', (_name, wireType) => {
    expect(
      formTypeToLogicalModelType(logicalModelTypeToForm(wireType)),
    ).toEqual(wireType);
  });

  it.each<[string, LogicalModelType, LogicalModelTypeNode]>([
    [
      'scalar',
      { scalar: 'uuid' },
      { kind: 'scalar', scalar: 'uuid', nullable: false },
    ],
    [
      'logical model',
      { logical_model: 'author' },
      { kind: 'logical_model', logicalModel: 'author', nullable: false },
    ],
    [
      'array with nullable items',
      { array: { scalar: 'text', nullable: true } },
      {
        kind: 'array',
        item: { kind: 'scalar', scalar: 'text', nullable: true },
        nullable: false,
      },
    ],
    [
      'nested arrays with a logical model item',
      { array: { array: { logical_model: 'author' } }, nullable: true },
      {
        kind: 'array',
        item: {
          kind: 'array',
          item: {
            kind: 'logical_model',
            logicalModel: 'author',
            nullable: false,
          },
          nullable: false,
        },
        nullable: true,
      },
    ],
  ])('defaults omitted nullability to false for %s', (_name, wireType, formType) => {
    expect(logicalModelTypeToForm(wireType)).toEqual(formType);
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

  it('preserves field names and trims descriptions only when serializing', () => {
    expect(
      formFieldsToLogicalModelFields([
        {
          name: '_id',
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
        name: '_id',
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
