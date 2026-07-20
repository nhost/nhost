import { FormProvider, useForm, useFormState, useWatch } from 'react-hook-form';
import { vi } from 'vitest';
import UniqueConstraintEditorSection from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/UniqueConstraintEditorSection';
import type { BaseTableFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/BaseTableForm';
import type { FormUniqueConstraint } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

mockPointerEvent();

const columns = [
  { name: 'alpha', type: 'text', formReference: 'column-alpha' },
  { name: 'beta', type: 'text', formReference: 'column-beta' },
];

const loadedConstraint: FormUniqueConstraint = {
  id: 'loaded-id',
  originalName: 'loaded_key',
  name: 'loaded_key',
  columnReferences: ['column-beta', 'column-alpha'],
};

function SectionHarness({
  constraints = [],
  onSubmit = vi.fn(),
}: {
  constraints?: FormUniqueConstraint[];
  onSubmit?: (values: BaseTableFormValues) => void;
}) {
  const form = useForm<BaseTableFormValues>({
    defaultValues: {
      name: 'table_name',
      columns,
      uniqueConstraints: constraints,
      foreignKeyRelations: [],
      primaryKeyIndices: [],
      identityColumnIndex: null,
    },
  });
  const values = useWatch({ control: form.control });
  const { isDirty } = useFormState({ control: form.control });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <UniqueConstraintEditorSection />
        <output data-testid="constraints-value">
          {JSON.stringify(values.uniqueConstraints)}
        </output>
        <output data-testid="parent-dirty">
          {isDirty ? 'dirty' : 'clean'}
        </output>
        <button type="submit">Outer submit</button>
      </form>
    </FormProvider>
  );
}

async function selectColumn(name: string, user: TestUserEvent) {
  await user.click(screen.getByRole('combobox', { name: 'Columns' }));
  await user.click(screen.getByRole('option', { name }));
}

async function waitForDialogsToClose() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
}

describe('UniqueConstraintEditorSection', () => {
  it('adds named and unnamed constraints with ordered summaries without submitting the outer form', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();
    render(<SectionHarness onSubmit={onSubmit} />);

    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');
    const addButton = screen.getByRole('button', {
      name: 'Add Unique Constraint',
    });
    expect(addButton).toHaveClass(
      'mt-1',
      'rounded-sm+',
      'border',
      'border-input',
    );
    await user.click(addButton);
    await user.type(screen.getByLabelText('Name (optional)'), 'ordered_key');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');
    await selectColumn('beta', user);
    await user.click(screen.getByRole('option', { name: 'alpha' }));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );

    expect(await screen.findByText('ordered_key')).toBeVisible();
    expect(screen.getByText('beta, alpha')).toBeVisible();
    expect(addButton).toHaveClass('justify-self-start');
    expect(addButton).not.toHaveClass('border-input');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('dirty');
    expect(onSubmit).not.toHaveBeenCalled();
    await waitForDialogsToClose();

    await user.click(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await selectColumn('beta', user);
    await user.click(screen.getByRole('option', { name: 'alpha' }));
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );

    expect(await screen.findByText('table_name_beta_alpha_key')).toBeVisible();
    expect(screen.getAllByText('beta, alpha')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and parent unchanged for invalid fields and duplicate sibling names', async () => {
    const user = new TestUserEvent();
    render(<SectionHarness constraints={[loadedConstraint]} />);
    const initialValue = screen.getByTestId('constraints-value').textContent;

    await user.click(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );
    expect(await screen.findByText('Select at least one column.')).toBeVisible();
    expect(screen.getByText('Add a Unique Constraint')).toBeVisible();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent(
      initialValue!,
    );

    await user.type(screen.getByLabelText('Name (optional)'), 'loaded_key');
    await selectColumn('alpha', user);
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Add' }),
    );

    expect(
      await screen.findByText(/with this name already exists/),
    ).toBeVisible();
    expect(screen.getByText('Add a Unique Constraint')).toBeVisible();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent(
      initialValue!,
    );
  });

  it('cancels clean and dirty drafts without changing or dirtying the parent', async () => {
    const user = new TestUserEvent();
    render(<SectionHarness />);

    await user.click(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Cancel' }),
    );
    await waitForDialogsToClose();
    expect(screen.queryByText('Add a Unique Constraint')).not.toBeInTheDocument();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent('[]');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');

    await user.click(
      screen.getByRole('button', { name: 'Add Unique Constraint' }),
    );
    await user.type(screen.getByLabelText('Name (optional)'), 'draft_key');
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Cancel' }),
    );
    expect(await screen.findByText('Unsaved changes')).toBeVisible();
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Discard' }),
    );

    await waitForDialogsToClose();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent('[]');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');
  });

  it('edits copied values while preserving domain identity and raw reference order', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();
    render(
      <SectionHarness constraints={[loadedConstraint]} onSubmit={onSubmit} />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Edit unique constraint loaded_key',
      }),
    );
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'renamed_key');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('constraints-value')).toHaveTextContent(
        '"id":"loaded-id","originalName":"loaded_key","name":"renamed_key","columnReferences":["column-beta","column-alpha"]',
      );
    });
    expect(screen.getByText('beta, alpha')).toBeVisible();
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('dirty');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('round-trips a checkbox-created unnamed singleton as optional', async () => {
    const user = new TestUserEvent();
    render(
      <SectionHarness
        constraints={[
          { id: 'checkbox-id', columnReferences: ['column-alpha'] },
        ]}
      />,
    );

    expect(screen.getByText('table_name_alpha_key')).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: 'Edit unique constraint table_name_alpha_key',
      }),
    );
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('');
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    await waitFor(() => {
      expect(
        JSON.parse(
          screen.getByTestId('constraints-value').textContent ?? 'null',
        ),
      ).toEqual([
        { id: 'checkbox-id', columnReferences: ['column-alpha'] },
      ]);
    });
  });

  it('shows missing references and leaves them ordered when invalid Edit is submitted', async () => {
    const user = new TestUserEvent();
    const missingConstraint = {
      ...loadedConstraint,
      columnReferences: ['missing-one', 'column-alpha', 'missing-two'],
    };
    render(<SectionHarness constraints={[missingConstraint]} />);
    const initialValue = screen.getByTestId('constraints-value').textContent;

    expect(
      screen.getByText(
        'Missing column (missing-one), alpha, Missing column (missing-two)',
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: 'Edit unique constraint loaded_key',
      }),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );

    expect(
      await screen.findByText(
        'Select only current columns. Remove any missing columns.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Edit Unique Constraint')).toBeVisible();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent(
      initialValue!,
    );
  });

  it('removes the constraint immediately without submitting the table form', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();
    render(
      <SectionHarness constraints={[loadedConstraint]} onSubmit={onSubmit} />,
    );

    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('clean');
    await user.click(
      screen.getByRole('button', {
        name: 'Delete unique constraint loaded_key',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText('loaded_key')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText(/removed when you save the table/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('constraints-value')).toHaveTextContent('[]');
    expect(screen.getByTestId('parent-dirty')).toHaveTextContent('dirty');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
