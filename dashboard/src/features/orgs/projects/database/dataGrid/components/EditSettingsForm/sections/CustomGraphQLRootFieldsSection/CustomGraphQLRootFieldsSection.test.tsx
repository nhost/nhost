import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import { vi } from 'vitest';
import CustomGraphQLRootFieldsSection from './CustomGraphQLRootFieldsSection';

mockPointerEvent();

const hooks = vi.hoisted(() => ({
  useTableCustomizationQuery: vi.fn(),
  useSetTableCustomizationMutation: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery',
  () => ({
    useTableCustomizationQuery: hooks.useTableCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation',
  () => ({
    useSetTableCustomizationMutation: hooks.useSetTableCustomizationMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: hooks.useGetMetadataResourceVersion,
  }),
);

function renderSection() {
  return render(
    <CustomGraphQLRootFieldsSection schema="public" tableName="user_profile" />,
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
    hooks.useTableCustomizationQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });
    hooks.useSetTableCustomizationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
    });
    hooks.useGetMetadataResourceVersion.mockReturnValue({
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

  it('camel-cases existing values without overriding non-empty fields', async () => {
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

    const commentToggle = screen.getAllByRole('combobox')[0];
    await user.click(commentToggle);
    await user.click(screen.getByRole('option', { name: 'None' }));
    expect(commentToggle).toHaveTextContent('None');

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));

    expect(customTableInput).toHaveDisplayValue('');
    expect(selectField).toHaveDisplayValue('');
    expect(insertField).toHaveDisplayValue('');
    expect(commentInput).toHaveDisplayValue('');
    expect(commentInput).not.toBeDisabled();
    expect(commentToggle).toHaveTextContent('Value');
  });
});
