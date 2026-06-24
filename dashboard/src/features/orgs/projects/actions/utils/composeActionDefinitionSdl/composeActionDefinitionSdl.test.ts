import { parseActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/parseActionDefinitionSdl';
import composeActionDefinitionSdl from './composeActionDefinitionSdl';

describe('composeActionDefinitionSdl', () => {
  it('composes a mutation action definition', () => {
    const sdl = composeActionDefinitionSdl({
      name: 'login',
      definition: {
        type: 'mutation',
        arguments: [
          { name: 'username', type: 'String!' },
          { name: 'password', type: 'String!' },
        ],
        output_type: 'LoginResponse',
      },
    });

    expect(sdl).toBe(`type Mutation {
  login(username: String!, password: String!): LoginResponse
}
`);
  });

  it('composes a query action definition without arguments', () => {
    const sdl = composeActionDefinitionSdl({
      name: 'currentTime',
      definition: {
        type: 'query',
        output_type: 'TimeResponse!',
      },
    });

    expect(sdl).toBe(`type Query {
  currentTime: TimeResponse!
}
`);
  });

  it('round-trips with parseActionDefinitionSdl', () => {
    const definition = {
      type: 'mutation' as const,
      arguments: [{ name: 'filters', type: '[SearchFilter!]!' }],
      output_type: '[SearchResult]',
    };

    const sdl = composeActionDefinitionSdl({ name: 'searchUsers', definition });
    const parsed = parseActionDefinitionSdl(sdl);

    expect(parsed.error).toBeNull();
    expect(parsed.definition).toEqual({
      name: 'searchUsers',
      arguments: definition.arguments,
      outputType: definition.output_type,
      type: definition.type,
    });
  });
});
