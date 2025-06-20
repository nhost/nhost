import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { vi } from 'vitest';
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
  const actualCurrentOrg = await vi.importActual<any>(
    '@/features/orgs/projects/hooks/useCurrentOrg',
  );
  return {
    ...actualCurrentOrg,
    useCurrentOrg: mocks.useCurrentOrg,
  };
});

vi.mock('@/utils/__generated__/graphql', async () => {
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useUpdateConfigMutation: mocks.useUpdateConfigMutation,
    useGetPostgresSettingsQuery: mocks.useGetPostgresSettingsQuery,
  };
});

vi.mock(
  '@/features/orgs/components/common/TransferOrUpgradeProjectDialog',
  async () => {
    const actual = await vi.importActual<any>(
      '@/features/orgs/components/common/TransferOrUpgradeProjectDialog',
    );
    return {
      ...actual,
      TransferOrUpgradeProjectDialog: () => null,
    };
  },
);

afterEach(() => {
  mocks.useCurrentOrg.mockRestore();
  mocks.updateConfigMock.mockRestore();
  mocks.useUpdateConfigMutation.mockRestore();
  mocks.useGetPostgresSettingsQuery.mockRestore();
});

test('If the org is free the switch should not be available and the save button is disabled', async () => {
  mocks.useCurrentOrg.mockImplementation(() => getCurrentOrg({ isFree: true }));
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
