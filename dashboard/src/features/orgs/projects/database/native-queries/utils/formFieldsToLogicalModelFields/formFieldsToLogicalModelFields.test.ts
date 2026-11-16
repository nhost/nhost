import { formFieldsToLogicalModelFields } from '@/features/orgs/projects/database/native-queries/utils/formFieldsToLogicalModelFields';

describe('formFieldsToLogicalModelFields', () => {
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
