import { vi } from 'vitest';
import TypedFieldRow from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

describe('TypedFieldRow', () => {
  it.each([
    ['Field', 'field'],
    ['Argument', 'argument'],
  ] as const)('provides exact accessible %s labels and shared row behavior', async (noun, lowercaseNoun) => {
    const onRemove = vi.fn();
    render(
      <TypedFieldRow
        noun={noun}
        index={1}
        nameInputProps={{ defaultValue: 'entry_name' }}
        descriptionInputProps={{
          className: 'caller-description-class',
          defaultValue: 'Entry description',
        }}
        nameError="Name is invalid."
        typeEditor={<div data-testid="type-editor-slot">Type editor</div>}
        onRemove={onRemove}
      />,
    );

    const row = screen.getByRole('group', { name: `${noun} 2` });
    const nameInput = screen.getByLabelText(`${noun} 2 name`);

    expect(row).toContainElement(nameInput);
    expect(nameInput).toHaveValue('entry_name');
    expect(nameInput).toHaveAccessibleDescription('Name is invalid.');
    const descriptionInput = screen.getByLabelText(`${noun} 2 description`);
    expect(descriptionInput).toHaveValue('Entry description');
    expect(descriptionInput).toHaveClass(
      'max-w-[33.5rem]',
      'caller-description-class',
    );
    expect(screen.getByTestId('type-editor-slot')).toHaveTextContent(
      'Type editor',
    );

    await new TestUserEvent().click(
      screen.getByRole('button', {
        name: `Remove ${lowercaseNoun} 2`,
      }),
    );
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
