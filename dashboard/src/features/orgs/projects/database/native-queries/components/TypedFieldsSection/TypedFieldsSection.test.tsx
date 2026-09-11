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
    const editor = screen.getByTestId('field-editor-region');
    const scrollContent = screen.getByTestId('field-scroll-content');
    const header = scrollContent.firstElementChild as HTMLElement;
    const rows = screen.getByTestId('typed-row').parentElement;
    const addButton = screen.getByRole('button', { name: 'Add field' });

    expect(section).toHaveAttribute('data-variant', 'field');
    expect(scrollContent.parentElement).toBe(editor);
    expect(scrollContent).toContainElement(
      screen.getByTestId('field-first-cell'),
    );
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
    expect(header.children).toHaveLength(6);
    expect(within(header).queryByText('Actions')).not.toBeInTheDocument();
    expect(within(header).queryByText('Remove')).not.toBeInTheDocument();
    expect(within(header).queryByText('*')).not.toBeInTheDocument();
    expect(header.querySelector('span.text-destructive')).toBeNull();
    expect(header).toHaveTextContent('NameKindType/valueNullableDescription');
    expect(rows?.parentElement).toBe(scrollContent);
    expect(screen.getByText('Add at least one field.')).toBeInTheDocument();
    expect(
      editor.compareDocumentPosition(addButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

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
    const editor = screen.getByTestId('argument-editor-region');
    const scrollContent = screen.getByTestId('argument-scroll-content');
    const header = scrollContent.firstElementChild as HTMLElement;

    expect(section).toHaveAttribute('data-variant', 'argument');
    expect(scrollContent.parentElement).toBe(editor);
    for (const label of ['Name', 'Type', 'Nullable', 'Description']) {
      expect(
        within(header).getByText(label, { exact: true }),
      ).toBeInTheDocument();
    }
    expect(header).toHaveTextContent('NameTypeNullableDescription');
    expect(header.children).toHaveLength(5);
    expect(within(header).queryByText('Actions')).not.toBeInTheDocument();
    expect(within(header).queryByText('Remove')).not.toBeInTheDocument();
    expect(within(header).queryByText('*')).not.toBeInTheDocument();
    expect(header.querySelector('span.text-destructive')).toBeNull();
    const argumentRow = screen.getByTestId('argument-row');
    expect(argumentRow).toBeInTheDocument();
    expect(argumentRow.parentElement?.parentElement).toBe(scrollContent);
    expect(
      screen.getByRole('button', { name: 'Add argument' }),
    ).toBeInTheDocument();
  });
});
