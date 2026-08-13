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
    expect(section).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(editor.parentElement).toHaveClass('mt-5');
    expect(editor).toHaveClass('w-full', 'overflow-x-auto');
    expect(editor.parentElement).not.toHaveClass('overflow-x-auto');
    expect(scrollContent).toHaveClass('w-max', 'min-w-full', 'pr-1');
    expect(scrollContent).not.toHaveClass('px-1', 'pl-1');
    expect(scrollContent.parentElement).toBe(editor);
    expect(scrollContent).toContainElement(
      screen.getByTestId('field-first-cell'),
    );
    expect(header).toHaveClass(
      'w-full',
      'grid-cols-[minmax(8.5rem,1fr)_minmax(7rem,0.8fr)_minmax(10.5rem,1.25fr)_5rem_6rem_4rem]',
      'min-w-[43.5rem]',
      'pb-2',
    );
    expect(header).not.toHaveClass('border-b');
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
    expect(rows).not.toHaveClass('divide-y', 'border-b');
    expect(rows?.parentElement).toBe(scrollContent);
    expect(screen.getByText('Add at least one field.')).toBeInTheDocument();
    expect(
      editor.compareDocumentPosition(addButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(addButton).toHaveClass('text-primary', 'hover:text-primary');
    expect(addButton.querySelector('svg')).toHaveClass('h-4', 'w-4');

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

    expect(section).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(editor.parentElement).toHaveClass('mt-5');
    expect(scrollContent).toHaveClass('w-max', 'min-w-full', 'pr-1');
    expect(scrollContent).not.toHaveClass('px-1', 'pl-1');
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
    expect(header).toHaveClass(
      'w-full',
      'grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.25fr)_5rem_6rem_4rem]',
      'min-w-[42rem]',
      'pb-2',
    );
    expect(header).not.toHaveClass('border-b');
    const argumentRow = screen.getByTestId('argument-row');
    expect(argumentRow).toBeInTheDocument();
    expect(argumentRow.parentElement).not.toHaveClass('divide-y', 'border-b');
    expect(argumentRow.parentElement?.parentElement).toBe(scrollContent);
    expect(
      screen.getByRole('button', { name: 'Add argument' }),
    ).toBeInTheDocument();
  });
});
