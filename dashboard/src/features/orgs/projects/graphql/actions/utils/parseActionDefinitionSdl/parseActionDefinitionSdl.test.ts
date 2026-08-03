import parseActionDefinitionSdl from './parseActionDefinitionSdl';

describe('parseActionDefinitionSdl', () => {
  it('parses a mutation action definition', () => {
    const result = parseActionDefinitionSdl(`type Mutation {
      login(username: String!, password: String!): LoginResponse
    }`);

    expect(result.error).toBeNull();
    expect(result.definition).toEqual({
      name: 'login',
      arguments: [
        { name: 'username', type: 'String!' },
        { name: 'password', type: 'String!' },
      ],
      outputType: 'LoginResponse',
      type: 'mutation',
    });
  });

  it('parses a query action definition with wrapped types', () => {
    const result = parseActionDefinitionSdl(`type Query {
      searchUsers(filters: [SearchFilter!]!): [SearchResult]
    }`);

    expect(result.error).toBeNull();
    expect(result.definition).toEqual({
      name: 'searchUsers',
      arguments: [{ name: 'filters', type: '[SearchFilter!]!' }],
      outputType: '[SearchResult]',
      type: 'query',
    });
  });

  it('parses an action defined with "extend type"', () => {
    const result = parseActionDefinitionSdl(`extend type Mutation {
      ping: PingResponse
    }`);

    expect(result.error).toBeNull();
    expect(result.definition?.name).toBe('ping');
    expect(result.definition?.arguments).toEqual([]);
  });

  it('returns an error for invalid SDL', () => {
    const result = parseActionDefinitionSdl('type Mutation {');

    expect(result.definition).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it.each([
    [
      'multiple types are defined',
      `type Mutation {
      login(username: String!): LoginResponse
    }

    type Query {
      logout: LogoutResponse
    }`,
      'The action must be defined under a single "Mutation" or "Query" type',
    ],
    [
      'the type is not Mutation or Query',
      `type Subscription {
      onLogin: LoginResponse
    }`,
      'The action must be defined under a "Mutation" or a "Query" type',
    ],
    [
      'multiple actions are defined',
      `type Mutation {
      login(username: String!): LoginResponse
      logout: LogoutResponse
    }`,
      'Multiple actions are defined ("login", "logout"). Please define only one.',
    ],
    [
      'no field is defined',
      'type Mutation',
      'Define the action as a field under the "Mutation" type',
    ],
  ])('returns an error when %s', (_description, sdl, expectedError) => {
    const result = parseActionDefinitionSdl(sdl);

    expect(result.definition).toBeNull();
    expect(result.error).toBe(expectedError);
  });
});
