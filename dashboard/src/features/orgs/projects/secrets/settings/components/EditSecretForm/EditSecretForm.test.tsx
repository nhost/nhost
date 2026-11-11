import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import type { UpdateSecretMutationVariables } from '@/generated/graphql';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import EditSecretForm from './EditSecretForm';

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

const secret = { name: '_LEGACY_TOKEN' };
const requests: UpdateSecretMutationVariables[] = [];

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('GetSecrets', () =>
    HttpResponse.json({
      data: {
        appSecrets: [{ ...secret, __typename: 'ConfigEnvironmentVariable' }],
      },
    }),
  ),
  nhostGraphQLLink.mutation<object, UpdateSecretMutationVariables>(
    'UpdateSecret',
    ({ variables }) => {
      requests.push(variables);
      return HttpResponse.json({
        data: {
          updateSecret: {
            __typename: 'ConfigEnvironmentVariable',
            name: secret.name,
          },
        },
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

it('replaces a secret whose name the create form would reject, with an empty value', async () => {
  const user = new TestUserEvent();
  render(<EditSecretForm originalSecret={secret} />);

  await user.click(screen.getByRole('button', { name: 'Replace' }));

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].secret).toEqual({ name: '_LEGACY_TOKEN', value: '' });
});
