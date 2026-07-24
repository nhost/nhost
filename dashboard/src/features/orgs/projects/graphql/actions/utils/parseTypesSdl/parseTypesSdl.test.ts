import parseTypesSdl from './parseTypesSdl';

describe('parseTypesSdl', () => {
  it('returns an empty list for an empty SDL', () => {
    expect(parseTypesSdl('')).toEqual({ types: [], error: null });
    expect(parseTypesSdl('  \n ')).toEqual({ types: [], error: null });
  });

  it('parses object, input object, scalar, and enum types', () => {
    const result = parseTypesSdl(`type SampleOutput {
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
    }`);

    expect(result.error).toBeNull();
    expect(result.types).toEqual([
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
  });

  it('parses descriptions on types, fields, and enum values', () => {
    const result = parseTypesSdl(`"""Sample output type"""
    type SampleOutput {
      """The access token"""
      accessToken: String!
    }

    enum Color {
      """Red color"""
      RED
    }`);

    expect(result.error).toBeNull();
    expect(result.types).toEqual([
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
    ]);
  });

  it('returns an error for invalid SDL', () => {
    const result = parseTypesSdl('type SampleOutput {');

    expect(result.types).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('returns an error for interface types', () => {
    const result = parseTypesSdl(`interface Node {
      id: ID!
    }`);

    expect(result.types).toEqual([]);
    expect(result.error).toBe('Interface types are not supported');
  });

  it('returns an error for union types', () => {
    const result = parseTypesSdl(`union SearchResult = User | Post`);

    expect(result.types).toEqual([]);
    expect(result.error).toBe('Union types are not supported');
  });
});
