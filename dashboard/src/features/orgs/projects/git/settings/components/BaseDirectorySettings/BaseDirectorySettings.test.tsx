import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import BaseDirectorySettings from './BaseDirectorySettings';

let storedBaseFolder = 'apps/dashboard';

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query('getProject', () =>
    HttpResponse.json({
      data: {
        apps: [{ ...mockApplication, nhostBaseFolder: storedBaseFolder }],
      },
    }),
  ),
  nhostGraphQLLink.mutation('updateApplication', () => {
    storedBaseFolder = 'apps/refetched';
    return HttpResponse.json({ data: { updateApp: mockApplication } });
  }),
);

beforeAll(() => {
  server.listen();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

beforeEach(() => {
  storedBaseFolder = 'apps/dashboard';
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllEnvs();
});

afterAll(() => server.close());

describe('BaseDirectorySettings', () => {
  it('refetches the project after a successful update', async () => {
    const user = new TestUserEvent();
    render(<BaseDirectorySettings />);

    const input = await screen.findByRole('textbox');
    await user.clear(input);
    await user.type(input, 'apps/web');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(
      'The base directory has been updated successfully.',
    );
    // only the refetch can bring in a value the form never submitted
    await waitFor(() => expect(input).toHaveValue('apps/refetched'));
  });
});
