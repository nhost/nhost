import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';
import {
  formTypeToLogicalModelType,
  logicalModelTypeToForm,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';

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
    expect(formTypeToLogicalModelType(logicalModelTypeToForm(wireType))).toEqual(
      wireType,
    );
  });
});
