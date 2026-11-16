import { TypedFieldsSection } from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';

describe('TypedFieldsSection', () => {
  it('renders the field headers, local overflow, error, and bottom Add action', async () => {
    const onAdd = vi.fn();
    render(
      <TypedFieldsSection
        variant="field"
        error="Add at least one field."
        onAdd={onAdd}
      >
        <div data-testid="typed-row">
          <span data-testid="field-first-cell">Row</span>
        </div>
      </TypedFieldsSection>,
    );

    const section = screen.getByRole('region', { name: 'Fields' });
    const header = screen.getByTestId('field-scroll-content')
      .firstElementChild as HTMLElement;
    const addButton = screen.getByRole('button', { name: 'Add field' });

    expect(section).toHaveAttribute('data-variant', 'field');
    for (const label of [
      'Name',
      'Kind',
      'Type/value',
      'Nullable',
      'Description',
    ]) {
      expect(
        within(header).getByText(label, { exact: true }),
      ).toBeInTheDocument();
    }
    expect(screen.getByTestId('field-first-cell')).toBeInTheDocument();
    expect(screen.getByText('Add at least one field.')).toBeInTheDocument();

    await new TestUserEvent().click(addButton);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders argument headers without the field-only columns', () => {
    render(
      <TypedFieldsSection variant="argument" onAdd={vi.fn()}>
        <div data-testid="argument-row">Row</div>
      </TypedFieldsSection>,
    );

    const section = screen.getByRole('region', { name: 'Arguments' });
    const header = screen.getByTestId('argument-scroll-content')
      .firstElementChild as HTMLElement;

    expect(section).toHaveAttribute('data-variant', 'argument');
    for (const label of ['Name', 'Type', 'Nullable', 'Description']) {
      expect(
        within(header).getByText(label, { exact: true }),
      ).toBeInTheDocument();
    }
    expect(
      within(header).queryByText('Kind', { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      within(header).queryByText('Type/value', { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('argument-row')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add argument' }),
    ).toBeInTheDocument();
  });
});
