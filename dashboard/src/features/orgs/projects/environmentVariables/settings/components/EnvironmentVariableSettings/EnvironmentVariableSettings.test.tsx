import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  mockApplication,
  mockMatchMediaValue,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';
import EnvironmentVariableSettings from './EnvironmentVariableSettings';

vi.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: mockApplication, loading: false }),
}));

const LONG_VARIABLE_NAME =
  'A_VARIABLE_NAME_SO_LONG_THAT_IT_DOES_NOT_FIT_ON_ONE_LINE_OF_THE_DIALOG';

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('GetEnvironmentVariables', () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          id: 'ConfigConfig',
          global: {
            __typename: 'ConfigGlobal',
            environment: [
              {
                __typename: 'ConfigGlobalEnvironmentVariable',
                id: LONG_VARIABLE_NAME,
                name: LONG_VARIABLE_NAME,
                value: 'value',
              },
            ],
          },
          hasura: { adminSecret: 'admin', webhookSecret: null, jwtSecrets: [] },
        },
      },
    }),
  ),
);

describe('EnvironmentVariableSettings', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  afterAll(() => {
    server.close();
  });

  it('shows the full name on hover in the edit dialog', async () => {
    const user = new TestUserEvent();
    render(<EnvironmentVariableSettings />);

    await user.click(
      await screen.findByRole('button', { name: `Edit ${LONG_VARIABLE_NAME}` }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTitle(LONG_VARIABLE_NAME)).toBeInTheDocument();
  });

  it('shows the full name on hover in the delete dialog', async () => {
    const user = new TestUserEvent();
    render(<EnvironmentVariableSettings />);

    await user.click(
      await screen.findByRole('button', {
        name: `Delete ${LONG_VARIABLE_NAME}`,
      }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByTitle(LONG_VARIABLE_NAME)).toBeInTheDocument();
  });
});
