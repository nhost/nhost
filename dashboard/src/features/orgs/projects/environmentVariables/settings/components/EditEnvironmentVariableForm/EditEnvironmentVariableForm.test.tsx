import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import type { UpdateConfigMutationVariables } from '@/generated/graphql';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import EditEnvironmentVariableForm from './EditEnvironmentVariableForm';

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

const variable = {
  id: 'AUTH_CUSTOM_KEY',
  name: 'AUTH_CUSTOM_KEY',
  value: 'old',
};
const requests: UpdateConfigMutationVariables[] = [];

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('GetEnvironmentVariables', () =>
    HttpResponse.json({
      data: {
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          global: {
            __typename: 'ConfigGlobal',
            environment: [
              { ...variable, __typename: 'ConfigGlobalEnvironmentVariable' },
            ],
          },
          hasura: { adminSecret: 'admin', webhookSecret: null, jwtSecrets: [] },
        },
      },
    }),
  ),
  nhostGraphQLLink.mutation<object, UpdateConfigMutationVariables>(
    'UpdateConfig',
    ({ variables }) => {
      requests.push(variables);
      return HttpResponse.json({
        data: { updateConfig: { id: 'ConfigConfig' } },
      });
    },
  ),
);

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  requests.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  toast.remove();
});
afterAll(() => server.close());

it('saves a variable whose name the create form would reject', async () => {
  const user = new TestUserEvent();
  render(
    <EditEnvironmentVariableForm originalEnvironmentVariable={variable} />,
  );

  await user.clear(screen.getByLabelText('Value'));
  await user.type(screen.getByLabelText('Value'), 'new');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].config.global?.environment).toEqual([
    { name: 'AUTH_CUSTOM_KEY', value: 'new' },
  ]);
});
