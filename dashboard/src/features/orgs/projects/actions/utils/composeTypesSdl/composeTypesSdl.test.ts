import type { ClientCustomType } from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { parseTypesSdl } from '@/features/orgs/projects/actions/utils/parseTypesSdl';
import composeTypesSdl from './composeTypesSdl';

describe('composeTypesSdl', () => {
  it('returns an empty string for an empty list', () => {
    expect(composeTypesSdl([])).toBe('');
  });

  it('composes all type kinds', () => {
    const sdl = composeTypesSdl([
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'accessToken', type: 'String!' }],
      },
      {
        kind: 'input_object',
        name: 'SampleInput',
        fields: [
          { name: 'username', type: 'String!' },
          { name: 'password', type: 'String!' },
        ],
      },
      { kind: 'scalar', name: 'SpecialDate' },
      {
        kind: 'enum',
        name: 'Color',
        values: [{ value: 'RED' }, { value: 'GREEN' }],
      },
    ]);

    expect(sdl).toBe(`type SampleOutput {
  accessToken: String!
}

input SampleInput {
  username: String!
  password: String!
}

scalar SpecialDate

enum Color {
  RED
  GREEN
}
`);
  });

  it('round-trips types with descriptions through parseTypesSdl', () => {
    const types: ClientCustomType[] = [
      {
        kind: 'object',
        name: 'SampleOutput',
        description: 'Sample output type',
        fields: [
          {
            name: 'accessToken',
            type: 'String!',
            description: 'The access token',
          },
        ],
      },
      {
        kind: 'enum',
        name: 'Color',
        values: [{ value: 'RED', description: 'Red color' }],
      },
    ];

    const result = parseTypesSdl(composeTypesSdl(types));

    expect(result.error).toBeNull();
    expect(result.types).toEqual(types);
  });

  it('does not include relationships in the SDL', () => {
    const sdl = composeTypesSdl([
      {
        kind: 'object',
        name: 'SampleOutput',
        fields: [{ name: 'userId', type: 'uuid!' }],
        relationships: [
          {
            name: 'user',
            type: 'object',
            remote_table: { schema: 'public', name: 'users' },
            field_mapping: { userId: 'id' },
          },
        ],
      },
    ]);

    expect(sdl).toBe(`type SampleOutput {
  userId: uuid!
}
`);
  });
});
