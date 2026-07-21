import { validationSchema } from '@/features/orgs/projects/ai/AgentForm/validation';
import { GraphiteAgentProviders_Enum } from '@/utils/__generated__/graphite.graphql';

const validFormValues = {
  name: 'Support agent',
  description: '',
  instructions: 'Help the user.',
  provider: GraphiteAgentProviders_Enum.Anthropic,
  model: 'claude-sonnet-4',
  webSearchEnabled: false,
  webSearchProvider: '',
  webSearchRequireApproval: false,
  webFetchEnabled: false,
  webFetchRequireApproval: false,
  graphqlEnabled: false,
  graphqlRequireApprovalQueries: false,
  graphqlRequireApprovalMutations: false,
  mcpServers: [
    {
      url: 'https://mcp.example.com',
      headers: '{"Authorization":"Bearer token"}',
      requireApproval: true,
      toolOverrides: '{"safe_tool":{"require_approval":false}}',
    },
  ],
};

describe('AgentForm MCP server validation', () => {
  it('attaches invalid JSON errors to each offending field', async () => {
    await expect(
      validationSchema.validate(
        {
          ...validFormValues,
          mcpServers: [
            {
              ...validFormValues.mcpServers[0],
              headers: '{',
              toolOverrides: '[',
            },
          ],
        },
        { abortEarly: false },
      ),
    ).rejects.toMatchObject({
      inner: expect.arrayContaining([
        expect.objectContaining({
          path: 'mcpServers[0].headers',
          message: 'Headers must be valid JSON.',
        }),
        expect.objectContaining({
          path: 'mcpServers[0].toolOverrides',
          message: 'Tool overrides must be valid JSON.',
        }),
      ]),
    });
  });

  it('accepts valid or empty optional JSON fields', async () => {
    await expect(validationSchema.validate(validFormValues)).resolves.toEqual(
      validFormValues,
    );
    await expect(
      validationSchema.validate({
        ...validFormValues,
        mcpServers: [
          {
            ...validFormValues.mcpServers[0],
            headers: '',
            toolOverrides: '   ',
          },
        ],
      }),
    ).resolves.toBeDefined();
  });
});
