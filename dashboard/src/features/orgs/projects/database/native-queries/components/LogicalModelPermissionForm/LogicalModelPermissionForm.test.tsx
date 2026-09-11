import LogicalModelPermissionForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm/LogicalModelPermissionForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const model: LogicalModelItem = {
  name: 'author',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
  ],
};
const filter = { id: { _eq: 'X-Hasura-User-Id' } };

describe('LogicalModelPermissionForm visual validation', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });
  beforeEach(() => {
    mockPointerEvent();
  });

  it.each([
    'not',
    'and',
    'or',
  ])('blocks Save for an empty %s and recovers without changing the stored filter', async (operator) => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const user = new TestUserEvent();
    render(
      // biome-ignore lint/a11y/useValidAriaRole: This component's role names a Hasura role, not an ARIA role.
      <LogicalModelPermissionForm
        model={model}
        models={[model]}
        role="user"
        availableRoles={['user']}
        permission={{ columns: ['id'], filter }}
        isPending={false}
        onRoleChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(await screen.findByText(operator, { exact: true }));
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getByRole('alert')).toHaveTextContent(
      `_${operator} must contain at least one child.`,
    );
    fireEvent.submit(save.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole('button', { name: 'Delete group' })[1],
    );
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.submit(save.closest('form')!);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        columns: ['id', 'name'],
        filter,
      }),
    );
  });
});
