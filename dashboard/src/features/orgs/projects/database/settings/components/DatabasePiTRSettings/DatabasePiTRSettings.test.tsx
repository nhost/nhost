import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getOrganizations } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import DatabasePiTRSettings from './DatabasePiTRSettings';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

function getCurrentOrg({ isFree }: { isFree: boolean }) {
  return {
    org: {
      plan: {
        isFree,
      },
    },
  };
}

function mockUseGetPostgresSettingsQueryResponse({
  retention,
}: {
  retention: number | null;
}) {
  const pitr = retention === null ? null : { retention };
  return {
    data: {
      config: {
        postgres: {
          pitr,
        },
      },
    },
  };
}

const mocks = vi.hoisted(() => ({
  useCurrentOrg: vi.fn(),
  useUpdateConfigMutation: vi.fn(),
  useGetPostgresSettingsQuery: vi.fn(),
  updateConfigMock: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actualCurrentOrg = await vi.importActual<any>(
    '@/features/orgs/projects/hooks/useCurrentOrg',
  );
  return {
    ...actualCurrentOrg,
    useCurrentOrg: mocks.useCurrentOrg,
  };
});

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useUpdateConfigMutation: mocks.useUpdateConfigMutation,
    useGetPostgresSettingsQuery: mocks.useGetPostgresSettingsQuery,
  };
});

vi.mock('@/features/orgs/components/common/TransferProjectDialog', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>(
    '@/features/orgs/components/common/TransferProjectDialog',
  );
  return {
    ...actual,
    TransferOrUpgradeProjectDialog: () => null,
  };
});

const server = setupServer(tokenQuery, getOrganizations);

describe('DatabasePiTRSettings', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  afterEach(() => {
    mocks.useCurrentOrg.mockRestore();
    mocks.updateConfigMock.mockRestore();
    mocks.useUpdateConfigMutation.mockRestore();
    mocks.useGetPostgresSettingsQuery.mockRestore();
  });

  test('If the org is free the switch should not be available and the save button is disabled', async () => {
    server.use(getProjectQuery);
    mocks.useCurrentOrg.mockImplementation(() =>
      getCurrentOrg({ isFree: true }),
    );
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockUseGetPostgresSettingsQueryResponse({ retention: null }),
    );
    render(<DatabasePiTRSettings />);
    const saveButton = await screen.findByRole('button', {
      name: 'Save',
    });

    expect(saveButton).toBeDisabled();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('the Save button is disabled until the switch in the header is not touched', async () => {
    server.use(getProjectQuery);
    mocks.useCurrentOrg.mockImplementation(() =>
      getCurrentOrg({ isFree: false }),
    );
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockUseGetPostgresSettingsQueryResponse({ retention: null }),
    );
    const user = new TestUserEvent();
    render(<DatabasePiTRSettings />);
    const saveButton = await screen.findByRole('button', {
      name: 'Save',
    });

    expect(saveButton).toBeDisabled();

    const PiTR = screen.getByRole('checkbox');
    await user.click(PiTR);
    expect(PiTR).toBeChecked();

    expect(
      await screen.findByRole('button', {
        name: 'Save',
      }),
    ).not.toBeDisabled();
  });

  test('should disable the savebutton after toggling back to original state', async () => {
    server.use(getProjectQuery);
    mocks.useCurrentOrg.mockImplementation(() =>
      getCurrentOrg({ isFree: false }),
    );
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockUseGetPostgresSettingsQueryResponse({ retention: 7 }),
    );
    const user = new TestUserEvent();
    render(<DatabasePiTRSettings />);

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await user.click(screen.getByRole('checkbox'));

    expect(
      await screen.findByRole('button', {
        name: 'Save',
      }),
    ).toBeDisabled();
  });

  test('should send { retention: 7 } when enabling PiTR', async () => {
    server.use(getProjectQuery);
    mocks.useCurrentOrg.mockImplementation(() =>
      getCurrentOrg({ isFree: false }),
    );
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockUseGetPostgresSettingsQueryResponse({ retention: null }),
    );
    const user = new TestUserEvent();
    render(<DatabasePiTRSettings />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    );
    expect(
      mocks.updateConfigMock.mock.calls[0][0].variables.config.postgres.pitr,
    ).toStrictEqual({ retention: 7 });
  });

  test('should send { pitr: null } when disabling PiTR', async () => {
    server.use(getProjectQuery);
    mocks.useCurrentOrg.mockImplementation(() =>
      getCurrentOrg({ isFree: false }),
    );
    mocks.useUpdateConfigMutation.mockImplementation(() => [
      mocks.updateConfigMock,
    ]);
    mocks.useGetPostgresSettingsQuery.mockImplementation(() =>
      mockUseGetPostgresSettingsQueryResponse({ retention: 7 }),
    );
    const user = new TestUserEvent();
    render(<DatabasePiTRSettings />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    );
    expect(
      mocks.updateConfigMock.mock.calls[0][0].variables.config.postgres,
    ).toStrictEqual({ pitr: null });
  });
});
