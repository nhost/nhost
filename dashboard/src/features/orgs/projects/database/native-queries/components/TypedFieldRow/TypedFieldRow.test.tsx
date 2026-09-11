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
      const rowGrid = row.querySelector(':scope > div');

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
      expect(removeButton).toHaveAttribute('type', 'button');
      expect(removeButton).toHaveAccessibleName(`Remove ${lowercaseNoun} 2`);
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
    },
  );

  it.each(['null', 'undefined', 'NaN'] as const)(
    'treats the literal description "%s" as populated',
    async (description) => {
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
    },
  );

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
