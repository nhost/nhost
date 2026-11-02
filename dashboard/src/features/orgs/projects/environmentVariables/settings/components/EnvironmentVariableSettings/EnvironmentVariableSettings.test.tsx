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

  it.each([
    {
      button: `Edit ${LONG_VARIABLE_NAME}`,
      dialogRole: 'dialog',
      dialogName: `Edit ${LONG_VARIABLE_NAME}`,
    },
    {
      button: `Delete ${LONG_VARIABLE_NAME}`,
      dialogRole: 'alertdialog',
      dialogName: 'Delete environment variable',
    },
  ] as const)(
    'shows the full variable name as a tooltip in the "$dialogName" dialog',
    async ({ button, dialogRole, dialogName }) => {
      const user = new TestUserEvent();
      render(<EnvironmentVariableSettings />);

      await user.click(await screen.findByRole('button', { name: button }));

      const dialog = await screen.findByRole(dialogRole, { name: dialogName });
      expect(within(dialog).getByTitle(LONG_VARIABLE_NAME)).toHaveTextContent(
        LONG_VARIABLE_NAME,
      );
    },
  );
});
