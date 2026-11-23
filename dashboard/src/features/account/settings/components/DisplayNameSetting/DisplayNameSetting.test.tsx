import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useRef } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';
import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DisplayNameSetting from './DisplayNameSetting';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer();

function ProfileName() {
  const user = useUserData();
  const nhost = useNhostClient();
  const originalSession = useRef(nhost.getUserSession());

  return (
    <>
      <h2>{user?.displayName}</h2>
      <button
        type="button"
        onClick={() => {
          const expectedSession = {
            ...originalSession.current,
            user: {
              ...originalSession.current?.user,
              displayName: 'Updated name',
            },
          };
          expect(
            JSON.stringify(nhost.getUserSession()) ===
              JSON.stringify(expectedSession),
          ).toBe(true);
        }}
      >
        Check stored session
      </button>
    </>
  );
}

async function saveName() {
  const user = new TestUserEvent();
  const input = await screen.findByRole('textbox', { name: 'Display name' });
  await user.clear(input);
  await user.type(input, 'Updated name');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  return user;
}

describe('DisplayNameSetting', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('updates session consumers immediately and preserves the rest of the session', async () => {
    server.use(
      nhostGraphQLLink.mutation('updateUserDisplayName', ({ variables }) => {
        expect(variables).toEqual({
          id: mockSession.user?.id,
          displayName: 'Updated name',
        });
        return HttpResponse.json({
          data: {
            updateUser: {
              id: mockSession.user?.id,
              displayName: 'Updated name',
            },
          },
        });
      }),
    );
    render(
      <>
        <ProfileName />
        <DisplayNameSetting />
      </>,
    );

    const user = await saveName();

    expect(
      await screen.findByRole('heading', { name: 'Updated name' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Check stored session' }),
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  it('keeps the original name and allows retrying when the update fails', async () => {
    server.use(
      nhostGraphQLLink.mutation('updateUserDisplayName', () =>
        HttpResponse.json({ errors: [{ message: 'Update failed' }] }),
      ),
    );
    render(
      <>
        <ProfileName />
        <DisplayNameSetting />
      </>,
    );

    await saveName();

    expect(await screen.findByText('Update failed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      mockSession.user?.displayName ?? '',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
