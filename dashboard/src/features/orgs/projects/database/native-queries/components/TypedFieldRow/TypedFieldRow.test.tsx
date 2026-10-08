import { TypedFieldRow } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

describe('TypedFieldRow', () => {
  it.each([
    ['Field', 'field'],
    ['Argument', 'argument'],
  ] as const)(
    'provides exact accessible %s labels and plain aligned row behavior',
    async (noun, lowercaseNoun) => {
      const onRemove = vi.fn();
      const user = new TestUserEvent();
      render(
        <TypedFieldRow
          noun={noun}
          index={1}
          nameInputProps={{ defaultValue: 'entry_name' }}
          descriptionInputProps={{ defaultValue: 'Entry description' }}
          descriptionValue="Entry description"
          nameError="Name is invalid."
          typeEditor={<div data-testid="type-editor-slot">Type editor</div>}
          onRemove={onRemove}
        />,
      );

      const row = screen.getByRole('group', { name: `${noun} 2` });
      const nameInput = screen.getByLabelText(`${noun} 2 name`);

      expect(row).toContainElement(nameInput);
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

      const removeButton = screen.getByRole('button', {
        name: `Remove ${lowercaseNoun} 2`,
      });

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
    },
  );

  it('treats a literal description that looks empty as populated', async () => {
    const user = new TestUserEvent();
    render(
      <TypedFieldRow
        noun="Field"
        index={0}
        nameInputProps={{ defaultValue: 'id' }}
        descriptionInputProps={{ defaultValue: 'null' }}
        descriptionValue="null"
        typeEditor={<div>Type editor</div>}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    expect(screen.getByLabelText('Field 1 description')).toHaveValue('null');
  });

  it('shows the empty description state', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Add description' }));
    expect(screen.getByLabelText('Field 1 description')).toHaveValue('');
  });
});
