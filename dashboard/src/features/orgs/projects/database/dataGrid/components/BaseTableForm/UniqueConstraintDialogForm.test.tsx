import { useState } from 'react';
import { vi } from 'vitest';
import { useDialog } from '@/components/common/DialogProvider';
import type { FormUniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import UniqueConstraintDialogForm from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/UniqueConstraintDialogForm';

mockPointerEvent();

const availableColumns = [
  { name: 'alpha', type: 'text', formReference: 'column-alpha' },
  { name: 'beta', type: 'text', formReference: 'column-beta' },
];

const emptyConstraint: FormUniqueConstraint = {
  id: 'constraint-id',
  name: '',
  columnReferences: [],
};

function DialogOpener({
  onSubmit,
}: {
  onSubmit: (values: FormUniqueConstraint) => Promise<void>;
}) {
  const { openDialog } = useDialog();

  return (
    <button
      type="button"
      onClick={() =>
        openDialog({
          title: 'Unique constraint',
          component: (
            <UniqueConstraintDialogForm
              defaultValues={emptyConstraint}
              availableColumns={availableColumns}
              onSubmit={onSubmit}
            />
          ),
        })
      }
    >
      Open unique constraint
    </button>
  );
}

function DirtyLifecycleHarness() {
  const [mounted, setMounted] = useState(true);
  const { closeDialogWithDirtyGuard } = useDialog();

  return (
    <>
      {mounted && (
        <UniqueConstraintDialogForm
          defaultValues={emptyConstraint}
          availableColumns={availableColumns}
          location="dialog"
        />
      )}
      <button type="button" onClick={() => setMounted(false)}>
        Unmount form
      </button>
      <button type="button" onClick={() => closeDialogWithDirtyGuard()}>
        Check dirty guard
      </button>
    </>
  );
}

describe('UniqueConstraintDialogForm', () => {
  it('preserves the raw name and selected reference insertion order', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = new TestUserEvent();
    render(
      <UniqueConstraintDialogForm
        defaultValues={emptyConstraint}
        availableColumns={availableColumns}
        tableName="table_name"
        onSubmit={onSubmit}
      />,
    );

    const nameInput = screen.getByLabelText('Name (optional)');
    expect(nameInput).toHaveAttribute('placeholder', 'table_name_key');
    await user.type(nameInput, '  raw_name  ');
    await user.click(screen.getByRole('combobox', { name: 'Columns' }));

    const popoverContent = screen
      .getByRole('option', { name: 'beta' })
      .closest('[data-radix-popper-content-wrapper]')?.firstElementChild;
    expect(popoverContent).toHaveClass('z-[1400]');

    await user.click(screen.getByRole('option', { name: 'beta' }));
    await user.click(screen.getByRole('option', { name: 'alpha' }));
    expect(nameInput).toHaveAttribute(
      'placeholder',
      'table_name_beta_alpha_key',
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 'constraint-id',
        name: '  raw_name  ',
        columnReferences: ['column-beta', 'column-alpha'],
      });
    });
    expect(emptyConstraint.columnReferences).toEqual([]);
  });

  it('submits a new constraint without a supplied name', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          id: 'constraint-id',
          columnReferences: ['column-alpha'],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Name (optional)')).toBeInTheDocument();
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 'constraint-id',
        columnReferences: ['column-alpha'],
      });
    });
  });

  it('shows field errors and does not submit invalid values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          id: 'loaded-id',
          originalName: 'legacy-name',
          name: '',
          columnReferences: [],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText(
        'A name is required for an existing UNIQUE constraint.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Select at least one column.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: '1invalid',
      message: 'Constraint name must start with a letter or underscore.',
    },
    {
      name: 'invalid-name',
      message:
        'Constraint name must contain only letters, numbers, or underscores.',
    },
    {
      name: 'a'.repeat(64),
      message: 'Constraint name must be at most 63 characters.',
    },
  ])('shows a field error for invalid name $name', async ({ name, message }) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = new TestUserEvent();
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          ...emptyConstraint,
          columnReferences: ['column-alpha'],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Name (optional)'), name);
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a field error for duplicate references', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          ...emptyConstraint,
          columnReferences: ['column-alpha', 'column-alpha'],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText('Each column may only be selected once.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts an unchanged legacy name that is invalid for a new identifier', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          id: 'loaded-id',
          originalName: 'legacy-name',
          name: 'legacy-name',
          columnReferences: ['column-alpha'],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 'loaded-id',
        originalName: 'legacy-name',
        name: 'legacy-name',
        columnReferences: ['column-alpha'],
      });
    });
  });

  it('keeps missing selections visible and ordered while blocking submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = new TestUserEvent();
    render(
      <UniqueConstraintDialogForm
        defaultValues={{
          id: 'constraint-id',
          name: '',
          columnReferences: ['missing-one', 'column-alpha', 'missing-two'],
        }}
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    const badgeLabels = screen
      .getAllByTestId(/Missing column/)
      .map(({ textContent }) => textContent)
      .filter(Boolean);
    expect(badgeLabels).toEqual([
      'Missing column (missing-one)',
      'Missing column (missing-two)',
    ]);

    await user.click(screen.getByRole('combobox', { name: 'Columns' }));
    const missingOptions = screen.getAllByRole('option', {
      name: /Missing column/,
    });
    expect(missingOptions.map(({ textContent }) => textContent)).toEqual([
      'Missing column (missing-one)',
      'Missing column (missing-two)',
    ]);
    expect(
      missingOptions.every((option) => option.hasAttribute('data-disabled')),
    ).toBe(true);

    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText(
        'Select only current columns. Remove any missing columns.',
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows apply errors and relies on DialogProvider to keep the dialog open', async () => {
    const user = new TestUserEvent();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Duplicate name'));
    render(<DialogOpener onSubmit={onSubmit} />);

    await user.click(
      screen.getByRole('button', { name: 'Open unique constraint' }),
    );
    await user.click(
      await screen.findByRole('combobox', { name: 'Columns' }),
    );
    await user.click(screen.getByRole('option', { name: 'alpha' }));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Duplicate name');
    expect(
      screen.getByRole('dialog', { name: 'Unique constraint' }),
    ).toBeInTheDocument();
  });

  it('cleans its distinct dirty source when the local form unmounts', async () => {
    const user = new TestUserEvent();
    render(<DirtyLifecycleHarness />);

    await user.type(screen.getByLabelText('Name (optional)'), 'changed');
    await user.click(screen.getByRole('button', { name: 'Unmount form' }));
    await user.click(screen.getByRole('button', { name: 'Check dirty guard' }));

    expect(
      screen.queryByText(
        'You have unsaved local changes. Are you sure you want to discard them?',
      ),
    ).not.toBeInTheDocument();
  });
});
