import logicalModelFieldsToForm from '@/features/orgs/projects/database/native-queries/utils/logicalModelFieldsToForm';
import type { LogicalModelField } from '@/utils/hasura-api/generated/schemas';

describe('logicalModelFieldsToForm', () => {
  it('restores field descriptions as stable form strings', () => {
    const fields: LogicalModelField[] = [
      {
        name: 'id',
        type: { scalar: 'uuid', nullable: false },
        description: '  External description  ',
      },
      {
        name: 'tags',
        type: { array: { scalar: 'text', nullable: true }, nullable: false },
      },
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
});
