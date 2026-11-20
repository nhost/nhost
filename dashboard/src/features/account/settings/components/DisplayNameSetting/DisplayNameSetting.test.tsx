import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import type {
  UpdateUserDisplayNameMutation,
  UpdateUserDisplayNameMutationVariables,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';
import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DisplayNameSetting from './DisplayNameSetting';

const mockUser = mockSession.user!;
const successMessage = 'Your display name has been updated successfully.';
const requests: UpdateUserDisplayNameMutationVariables[] = [];
const server = setupServer(
  nhostGraphQLLink.mutation<
    UpdateUserDisplayNameMutation,
    UpdateUserDisplayNameMutationVariables
  >('updateUserDisplayName', ({ variables }) => {
    requests.push(variables);
    return HttpResponse.json({
      data: {
        updateUser: {
          id: variables.id,
          displayName: variables.displayName.trim(),
        },
      },
    });
  }),
);

function AccountDetails() {
  const user = useUserData();
  const nhost = useNhostClient();
  const [page, setPage] = useState(0);

  return (
    <>
      <output data-testid="account-name">{user?.displayName}</output>
      <output data-testid="stored-name">
        {nhost.getUserSession()?.user?.displayName}
      </output>
      <button type="button" onClick={() => setPage((value) => value + 1)}>
        Revisit settings
      </button>
      <DisplayNameSetting key={page} />
    </>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  requests.length = 0;
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});
afterEach(() => {
  server.resetHandlers();
  toast.remove();
});
afterAll(() => server.close());

async function saveName(name: string) {
  const user = new TestUserEvent();
  const input = screen.getByRole('textbox', { name: 'Display Name' });
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  return user;
}

describe('DisplayNameSetting', () => {
  it('sends the name, updates account and stored details, and keeps it on revisiting settings', async () => {
    render(<AccountDetails />);

    await waitFor(() => {
      expect(screen.getByTestId('account-name')).toHaveTextContent(
        mockUser.displayName,
      );
    });
    const user = await saveName('Rui Almeida');

    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    expect(requests).toEqual([{ id: mockUser.id, displayName: 'Rui Almeida' }]);
    expect(screen.getByTestId('account-name')).toHaveTextContent('Rui Almeida');
    expect(screen.getByTestId('stored-name')).toHaveTextContent('Rui Almeida');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Revisit settings' }));

    expect(screen.getByRole('textbox', { name: 'Display Name' })).toHaveValue(
      'Rui Almeida',
    );
  });

  it('uses the name returned by the server as the saved value', async () => {
    render(<AccountDetails />);
    await saveName('  Rui Almeida  ');

    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Display Name' })).toHaveValue(
      'Rui Almeida',
    );
    expect(screen.getByTestId('account-name')).toHaveTextContent('Rui Almeida');
    expect(screen.getByTestId('stored-name')).toHaveTextContent('Rui Almeida');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it.each([null, { id: 'different-user', displayName: 'Rui Almeida' }])(
    'does not report success or change account details for an invalid returned record %s',
    async (updateUser) => {
      server.use(
        nhostGraphQLLink.mutation('updateUserDisplayName', () =>
          HttpResponse.json({ data: { updateUser } }),
        ),
      );
      render(<AccountDetails />);
      await saveName('Rui Almeida');

      expect(
        await screen.findByText(
          'Your display name could not be updated. Please try again.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
      expect(screen.getByTestId('account-name')).toHaveTextContent(
        mockUser.displayName,
      );
      expect(screen.getByTestId('stored-name')).toHaveTextContent(
        mockUser.displayName,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    },
  );

  it('keeps the entered name available for retry when saving fails', async () => {
    server.use(
      nhostGraphQLLink.mutation('updateUserDisplayName', () =>
        HttpResponse.json({
          errors: [{ message: 'Unable to save display name' }],
        }),
      ),
    );
    render(<AccountDetails />);
    await saveName('Rui Almeida');

    expect(
      await screen.findByText('Unable to save display name'),
    ).toBeInTheDocument();
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Display Name' })).toHaveValue(
      'Rui Almeida',
    );
    expect(screen.getByTestId('account-name')).toHaveTextContent(
      mockUser.displayName,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
