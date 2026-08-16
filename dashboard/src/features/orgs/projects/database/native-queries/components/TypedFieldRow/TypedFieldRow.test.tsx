import { TypedFieldRow } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

describe('TypedFieldRow', () => {
  it.each([
    ['Field', 'field'],
    ['Argument', 'argument'],
  ] as const)('provides exact accessible %s labels and plain aligned row behavior', async (noun, lowercaseNoun) => {
    const onRemove = vi.fn();
    const user = new TestUserEvent();
    render(
      <TypedFieldRow
        noun={noun}
        index={1}
        nameInputProps={{ defaultValue: 'entry_name' }}
        descriptionInputProps={{
          className: 'caller-description-class',
          defaultValue: 'Entry description',
        }}
        descriptionValue="Entry description"
        nameError="Name is invalid."
        typeEditor={<div data-testid="type-editor-slot">Type editor</div>}
        onRemove={onRemove}
      />,
    );

    const row = screen.getByRole('group', { name: `${noun} 2` });
    const nameInput = screen.getByLabelText(`${noun} 2 name`);
    const rowGrid = row.querySelector(':scope > div');

    expect(row).toContainElement(nameInput);
    expect(row).not.toHaveClass('rounded-md', 'bg-muted', 'p-3', 'border-b');
    expect(rowGrid).not.toHaveClass('border-b', 'divide-y');
    expect(rowGrid).toHaveClass(
      'grid',
      'w-full',
      'items-start',
      'gap-2',
      noun === 'Field'
        ? 'grid-cols-[minmax(8.5rem,1fr)_minmax(7rem,0.8fr)_minmax(10.5rem,1.25fr)_5rem_6rem_4rem]'
        : 'grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.25fr)_5rem_6rem_4rem]',
    );
    expect(nameInput).toHaveValue('entry_name');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAccessibleDescription('Name is invalid.');
    expect(screen.getByTestId('type-editor-slot')).toHaveTextContent(
      'Type editor',
    );

    const descriptionTrigger = screen.getByRole('button', {
      name: 'Edit description',
    });
    await user.click(descriptionTrigger);
    const descriptionInput = screen.getByLabelText(`${noun} 2 description`);
    expect(descriptionInput).toHaveValue('Entry description');
    expect(descriptionInput).toHaveClass(
      'resize-none',
      'caller-description-class',
    );

    const removeButton = screen.getByRole('button', {
      name: `Remove ${lowercaseNoun} 2`,
    });
    expect(removeButton).toHaveClass('h-9', 'w-9', 'border', 'bg-background');
    expect(removeButton).toHaveAttribute('type', 'button');
    expect(removeButton).toHaveAccessibleName(`Remove ${lowercaseNoun} 2`);
    expect(removeButton.querySelector('svg')).toHaveClass(
      'lucide-x',
      'h-4',
      'w-4',
    );
    expect(removeButton.parentElement).toBe(rowGrid?.lastElementChild);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(descriptionInput).not.toBeInTheDocument();
      expect(descriptionTrigger).toHaveFocus();
    });
    await user.keyboard('{Tab}');
    expect(removeButton).toHaveFocus();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it.each([
    'null',
    'undefined',
    'NaN',
  ] as const)('treats the literal description "%s" as populated', async (description) => {
    const user = new TestUserEvent();
    render(
      <TypedFieldRow
        noun="Field"
        index={0}
        nameInputProps={{ defaultValue: 'id' }}
        descriptionInputProps={{ defaultValue: description }}
        descriptionValue={description}
        typeEditor={<div>Type editor</div>}
        onRemove={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Edit description',
    });
    expect(
      trigger.querySelector('.lucide-message-square-text'),
    ).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByLabelText('Field 1 description')).toHaveValue(
      description,
    );
  });

  it('shows the empty description state and restores trigger focus on Escape', async () => {
    const user = new TestUserEvent();
    render(
      <TypedFieldRow
        noun="Field"
        index={0}
        nameInputProps={{ defaultValue: 'id' }}
        descriptionInputProps={{ defaultValue: '' }}
        descriptionValue=""
        typeEditor={<div>Type editor</div>}
        onRemove={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'Add description',
    });
    await user.click(trigger);
    const textarea = screen.getByLabelText('Field 1 description');
    await user.type(textarea, 'Identifier');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Field 1 description'),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
