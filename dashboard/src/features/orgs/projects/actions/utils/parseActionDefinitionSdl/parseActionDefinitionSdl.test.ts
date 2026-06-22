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

  it('returns an error when multiple types are defined', () => {
    const result = parseActionDefinitionSdl(`type Mutation {
      login(username: String!): LoginResponse
    }

    type Query {
      logout: LogoutResponse
    }`);

    expect(result.definition).toBeNull();
    expect(result.error).toBe(
      'The action must be defined under a single "Mutation" or "Query" type',
    );
  });

  it('returns an error when the type is not Mutation or Query', () => {
    const result = parseActionDefinitionSdl(`type Subscription {
      onLogin: LoginResponse
    }`);

    expect(result.definition).toBeNull();
    expect(result.error).toBe(
      'The action must be defined under a "Mutation" or a "Query" type',
    );
  });

  it('returns an error when multiple actions are defined', () => {
    const result = parseActionDefinitionSdl(`type Mutation {
      login(username: String!): LoginResponse
      logout: LogoutResponse
    }`);

    expect(result.definition).toBeNull();
    expect(result.error).toBe(
      'Multiple actions are defined ("login", "logout"). Please define only one.',
    );
  });

  it('returns an error when no field is defined', () => {
    const result = parseActionDefinitionSdl('type Mutation');

    expect(result.definition).toBeNull();
    expect(result.error).toBe(
      'Define the action as a field under the "Mutation" type',
    );
  });
});
