import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryToFormValues';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const original: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {
    limit: {
      type: 'integer',
      nullable: true,
      description: '  External limit description  ',
    },
  },
  code: 'SELECT * FROM authors LIMIT {{limit}}',
  returns: 'author_result',
  description: '  Created outside the dashboard  ',
};

describe('nativeQueryToFormValues', () => {
  it('maps optional metadata descriptions to stable form strings without trimming', () => {
    expect(nativeQueryToFormValues(original, 'analytics')).toEqual({
      source: 'analytics',
      rootFieldName: 'authors',
      description: '  Created outside the dashboard  ',
      returns: 'author_result',
      code: 'SELECT * FROM authors LIMIT {{limit}}',
      arguments: [
        {
          name: 'limit',
          type: 'integer',
          nullable: true,
          description: '  External limit description  ',
        },
      ],
    });
    expect(
      nativeQueryToFormValues(
        { ...original, description: undefined },
        'analytics',
      ).description,
    ).toBe('');
  });
});
