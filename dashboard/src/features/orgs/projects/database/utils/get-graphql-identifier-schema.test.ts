import { getGraphQLIdentifierSchema } from '@/features/orgs/projects/database/utils/get-graphql-identifier-schema';

const schema = getGraphQLIdentifierSchema('Field name');

describe('getGraphQLIdentifierSchema', () => {
  it.each([
    'name',
    'name123',
    '_leading',
  ])('accepts the valid identifier %j unchanged', (identifier) => {
    expect(schema.parse(identifier)).toBe(identifier);
  });

  it.each([
    [
      '',
      [
        'Field name is required',
        'Field name must start with a letter or underscore.',
        'Field name must contain only letters, numbers, or underscores.',
      ],
    ],
    [
      ' ',
      [
        'Field name must start with a letter or underscore.',
        'Field name must contain only letters, numbers, or underscores.',
      ],
    ],
    [
      ' name',
      [
        'Field name must start with a letter or underscore.',
        'Field name must contain only letters, numbers, or underscores.',
      ],
    ],
    [
      'name ',
      ['Field name must contain only letters, numbers, or underscores.'],
    ],
    [
      'my-name!',
      ['Field name must contain only letters, numbers, or underscores.'],
    ],
    ['1name', ['Field name must start with a letter or underscore.']],
  ])('rejects %j with the exact messages', (identifier, messages) => {
    const result = schema.safeParse(identifier);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        messages,
      );
    }
  });
});
