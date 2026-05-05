import { vi } from 'vitest';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import CustomGraphQLRootFieldsSection from './CustomGraphQLRootFieldsSection';

mockPointerEvent();

const mocks = vi.hoisted(() => ({
  useTableCustomizationQuery: vi.fn(),
  useSetTableCustomizationMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
}));

const dialogMocks = vi.hoisted(() => ({
  setDirtySource: vi.fn(),
}));

vi.mock('@/components/common/DialogProvider', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/common/DialogProvider')
  >('@/components/common/DialogProvider');
  return {
    ...actual,
    useDialog: () => ({
      setDirtySource: dialogMocks.setDirtySource,
      onDirtyStateChange: vi.fn(),
      openDialog: vi.fn(),
      openDrawer: vi.fn(),
      openAlertDialog: vi.fn(),
      closeDialog: vi.fn(),
      closeDrawer: vi.fn(),
      closeDialogWithDirtyGuard: vi.fn(),
      closeDrawerWithDirtyGuard: vi.fn(),
      closeAlertDialog: vi.fn(),
      openDirtyConfirmation: vi.fn(),
    }),
  };
});

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery',
  () => ({
    useTableCustomizationQuery: mocks.useTableCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation',
  () => ({
    useSetTableCustomizationMutation: mocks.useSetTableCustomizationMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

function renderSection(tableName = 'user_profile', schema = 'public') {
  return render(
    <CustomGraphQLRootFieldsSection schema={schema} tableName={tableName} />,
  );
}

async function ensureSectionOpen(user: TestUserEvent, name: string) {
  const trigger = screen.getByRole('button', { name });

  if (trigger.getAttribute('aria-expanded') === 'true') {
    return;
  }

  await user.click(trigger);
}

async function openAllSections(user: TestUserEvent) {
  await ensureSectionOpen(user, 'Query and Subscription');
  await ensureSectionOpen(user, 'Mutation');
}

describe('CustomGraphQLRootFieldsSection', () => {
  beforeEach(() => {
    mocks.useTableCustomizationQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useSetTableCustomizationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
    });
    mocks.useGetMetadataResourceVersion.mockReturnValue({
      data: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fills empty inputs with camel-cased placeholders when Make camelCase is clicked', async () => {
    const user = new TestUserEvent();
    renderSection();
    await openAllSections(user);

    const [customTableInput, selectField] = screen.getAllByPlaceholderText(
      'user_profile (default)',
    );
    const insertField = screen.getByPlaceholderText(
      'insert_user_profile (default)',
    );

    expect(customTableInput).toHaveDisplayValue('');
    expect(selectField).toHaveDisplayValue('');
    expect(insertField).toHaveDisplayValue('');

    await user.click(screen.getByRole('button', { name: 'Make camelCase' }));

    expect(customTableInput).toHaveDisplayValue('userProfile');
    expect(selectField).toHaveDisplayValue('userProfile');
    expect(insertField).toHaveDisplayValue('insertUserProfile');
  });

  it('camel-cases existing values without overwriting non-empty fields', async () => {
    const user = new TestUserEvent();
    renderSection();
    await openAllSections(user);

    const [customTableInput] = screen.getAllByPlaceholderText(
      'user_profile (default)',
    );
    const selectAggregateField = screen.getByPlaceholderText(
      'user_profile_aggregate (default)',
    );
    const insertOneField = screen.getByPlaceholderText(
      'insert_user_profile_one (default)',
    );

    await user.type(customTableInput, 'custom_table');
    await user.type(selectAggregateField, 'custom_select_field');
    await user.type(insertOneField, 'insert_custom_field');

    await user.click(screen.getByRole('button', { name: 'Make camelCase' }));

    expect(customTableInput).toHaveDisplayValue('customTable');
    expect(selectAggregateField).toHaveDisplayValue('customSelectField');
    expect(insertOneField).toHaveDisplayValue('insertCustomField');
  });

  it('camel-cases existing values with a custom table name that is already camel-cased', async () => {
    const user = new TestUserEvent();
    renderSection('userProfile');
    await openAllSections(user);

    const [customTableInput] = screen.getAllByPlaceholderText(
      'userProfile (default)',
    );
    const selectAggregateField = screen.getByPlaceholderText(
      'userProfile_aggregate (default)',
    );
    const insertOneField = screen.getByPlaceholderText(
      'insert_userProfile_one (default)',
    );

    TestUserEvent.fireTypeEvent(customTableInput, 'userProfileCustom');
    TestUserEvent.fireTypeEvent(selectAggregateField, 'custom_select_field');

    await user.click(screen.getByRole('button', { name: 'Make camelCase' }));

    expect(customTableInput).toHaveDisplayValue('userProfileCustom');
    expect(selectAggregateField).toHaveDisplayValue('customSelectField');
    expect(insertOneField).toHaveDisplayValue('insertUserProfileCustomOne');
  });

  it('prefixes the default placeholders with the schema name for non-public schemas', async () => {
    const user = new TestUserEvent();
    renderSection('roles', 'auth');
    await openAllSections(user);

    const [customTableInput, selectField] = screen.getAllByPlaceholderText(
      'auth_roles (default)',
    );
    const selectAggregateField = screen.getByPlaceholderText(
      'auth_roles_aggregate (default)',
    );
    const insertField = screen.getByPlaceholderText(
      'insert_auth_roles (default)',
    );
    const insertOneField = screen.getByPlaceholderText(
      'insert_auth_roles_one (default)',
    );

    expect(customTableInput).toHaveDisplayValue('');
    expect(selectField).toHaveDisplayValue('');
    expect(selectAggregateField).toHaveDisplayValue('');
    expect(insertField).toHaveDisplayValue('');
    expect(insertOneField).toHaveDisplayValue('');

    await user.click(screen.getByRole('button', { name: 'Make camelCase' }));

    expect(customTableInput).toHaveDisplayValue('authRoles');
    expect(selectField).toHaveDisplayValue('authRoles');
    expect(insertField).toHaveDisplayValue('insertAuthRoles');
  });

  it('reports dirty state through setDirtySource when a field is edited and on unmount', async () => {
    const user = new TestUserEvent();
    const { unmount } = renderSection();
    await openAllSections(user);

    expect(dialogMocks.setDirtySource).not.toHaveBeenCalledWith(
      'edit-gql-root-fields',
      true,
    );

    const [customTableInput] = screen.getAllByPlaceholderText(
      'user_profile (default)',
    );
    await user.type(customTableInput, 'custom_table');

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-root-fields',
      true,
    );

    dialogMocks.setDirtySource.mockClear();
    unmount();

    expect(dialogMocks.setDirtySource).toHaveBeenCalledWith(
      'edit-gql-root-fields',
      false,
    );
  });

  it('resets every field back to defaults when Reset to default is clicked', async () => {
    const user = new TestUserEvent();
    renderSection();
    await openAllSections(user);

    const [customTableInput, selectField] = screen.getAllByPlaceholderText(
      'user_profile (default)',
    );
    const insertField = screen.getByPlaceholderText(
      'insert_user_profile (default)',
    );
    const commentInput = screen.getByPlaceholderText(
      'fetch data from the table: "user_profile"',
    );

    await user.click(screen.getByRole('button', { name: 'Make camelCase' }));
    await user.type(commentInput, 'My comment');

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));

    expect(customTableInput).toHaveDisplayValue('');
    expect(selectField).toHaveDisplayValue('');
    expect(insertField).toHaveDisplayValue('');
    expect(commentInput).toHaveDisplayValue('');
    expect(commentInput).toHaveAttribute(
      'placeholder',
      'fetch data from the table: "user_profile"',
    );
  });
});
