import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DatabaseAllowedCIDRs from './DatabaseAllowedCIDRs';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

function mockPostgresSettingsResponse({
  enablePublicAccess,
  allowedCIDRs,
}: {
  enablePublicAccess: boolean;
  allowedCIDRs: string[] | null;
}) {
  return {
    data: {
      config: {
        postgres: {
          resources: {
            enablePublicAccess,
            allowedCIDRs,
          },
        },
      },
    },
  };
}

const mocks = vi.hoisted(() => ({
  useUpdateConfigMutation: vi.fn(),
  useGetPostgresSettingsQuery: vi.fn(),
  updateConfigMock: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ project: mockApplication }),
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useUpdateConfigMutation: mocks.useUpdateConfigMutation,
    useGetPostgresSettingsQuery: mocks.useGetPostgresSettingsQuery,
  };
});

const server = setupServer(tokenQuery);

describe('DatabaseAllowedCIDRs', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterEach(() => {
    mocks.updateConfigMock.mockRestore();
    mocks.useUpdateConfigMutation.mockRestore();
    mocks.useGetPostgresSettingsQuery.mockRestore();
  });

  afterAll(() => {
    server.close();
  });

  function setupMocks({
    enablePublicAccess,
    allowedCIDRs,
  }: {
    enablePublicAccess: boolean;
    allowedCIDRs: string[] | null;
  }) {
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockPostgresSettingsResponse({ enablePublicAccess, allowedCIDRs }),
    );
  }

  test('returns null when enablePublicAccess is false', () => {
    setupMocks({ enablePublicAccess: false, allowedCIDRs: null });
    render(<DatabaseAllowedCIDRs />);
    expect(screen.queryByText('Allowed CIDRs')).not.toBeInTheDocument();
  });

  test('renders when enablePublicAccess is true', async () => {
    setupMocks({ enablePublicAccess: true, allowedCIDRs: null });
    render(<DatabaseAllowedCIDRs />);
    expect(await screen.findByText('Allowed CIDRs')).toBeInTheDocument();
  });

  test('can add and remove CIDR fields up to max of 3', async () => {
    setupMocks({ enablePublicAccess: true, allowedCIDRs: null });
    const user = new TestUserEvent();
    render(<DatabaseAllowedCIDRs />);

    const addButton = await screen.findByRole('button', { name: /add cidr/i });

    await user.click(addButton);
    expect(screen.getAllByPlaceholderText(/192\.168\.1\.0\/24/)).toHaveLength(1);

    await user.click(addButton);
    expect(screen.getAllByPlaceholderText(/192\.168\.1\.0\/24/)).toHaveLength(2);

    await user.click(addButton);
    expect(screen.getAllByPlaceholderText(/192\.168\.1\.0\/24/)).toHaveLength(3);

    expect(
      screen.queryByRole('button', { name: /add cidr/i }),
    ).not.toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: '' });
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText(/192\.168\.1\.0\/24/)).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /add cidr/i }),
    ).toBeInTheDocument();
  });

  test('shows validation error for invalid CIDR', async () => {
    setupMocks({ enablePublicAccess: true, allowedCIDRs: null });
    const user = new TestUserEvent();
    render(<DatabaseAllowedCIDRs />);

    await user.click(
      await screen.findByRole('button', { name: /add cidr/i }),
    );

    const input = screen.getByPlaceholderText(/192\.168\.1\.0\/24/);
    await user.type(input, 'not-a-cidr');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen.getByText('Must be a valid CIDR (e.g., 192.168.1.0/24)'),
      ).toBeInTheDocument();
    });
  });

  test('shows required error for empty CIDR', async () => {
    setupMocks({ enablePublicAccess: true, allowedCIDRs: null });
    const user = new TestUserEvent();
    render(<DatabaseAllowedCIDRs />);

    await user.click(
      await screen.findByRole('button', { name: /add cidr/i }),
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('CIDR is required')).toBeInTheDocument();
    });
  });

  test('calls updateConfig with correct payload on submit', async () => {
    setupMocks({ enablePublicAccess: true, allowedCIDRs: null });
    const user = new TestUserEvent();
    render(<DatabaseAllowedCIDRs />);

    await user.click(
      await screen.findByRole('button', { name: /add cidr/i }),
    );

    const input = screen.getByPlaceholderText(/192\.168\.1\.0\/24/);
    await user.type(input, '10.0.0.0/8');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.updateConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            config: {
              postgres: {
                resources: {
                  allowedCIDRs: ['10.0.0.0/8'],
                },
              },
            },
          }),
        }),
      );
    });
  });

  test('sends allowedCIDRs: null when all CIDRs are removed', async () => {
    setupMocks({
      enablePublicAccess: true,
      allowedCIDRs: ['192.168.1.0/24'],
    });
    const user = new TestUserEvent();
    render(<DatabaseAllowedCIDRs />);

    await screen.findByText('Allowed CIDRs');

    const removeButtons = screen.getAllByRole('button', { name: '' });
    const trashButton = removeButtons.find((btn) =>
      btn.querySelector('svg.lucide-trash'),
    );
    expect(trashButton).toBeTruthy();
    await user.click(trashButton!);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.updateConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            config: {
              postgres: {
                resources: {
                  allowedCIDRs: null,
                },
              },
            },
          }),
        }),
      );
    });
  });
});
