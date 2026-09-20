import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types';
import { logicalModelTypeToForm } from '@/features/orgs/projects/database/native-queries/utils/logicalModelTypeToForm';
import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';

describe('logicalModelTypeToForm', () => {
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
  ])(
    'defaults omitted nullability to false for %s',
    (_name, wireType, formType) => {
      expect(logicalModelTypeToForm(wireType)).toEqual(formType);
    },
  );
});
