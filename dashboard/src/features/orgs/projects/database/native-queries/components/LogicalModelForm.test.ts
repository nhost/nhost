import { createElement } from 'react';
import { vi } from 'vitest';
import LogicalModelForm, {
  createLogicalModelFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelForm';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const field = (name: string, description = '') => ({
  name,
  type: { kind: 'scalar' as const, scalar: 'text', nullable: true },
  description,
});

function renderLogicalModelForm(
  fields = [field('id', 'Identifier')],
  originalName?: string,
) {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  const result = render(
    createElement(LogicalModelForm, {
      resetToken: 'test',
      values: {
        source: 'default',
        name: 'result',
        description: '',
        fields,
      },
      existingNames: [],
      originalName,
      logicalModelNames: ['related_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
      onDirtyChange,
    }),
  );

  return { ...result, onSubmit, onDirtyChange };
}

describe('logical model form validation', () => {
  it('requires a name and complete recursive fields', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: '',
      description: '',
      fields: [
        {
          name: '',
          type: {
            kind: 'array',
            nullable: false,
            item: { kind: 'logical_model', logicalModel: '', nullable: true },
          },
          description: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate field names', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '',
      fields: [field('id'), field('id')],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ message: 'Field names must be unique.' }),
    );
  });

  it('rejects collisions while allowing an unchanged edit name', () => {
    expect(
      createLogicalModelFormSchema(['result']).safeParse({
        source: 'default',
        name: 'result',
        description: '',
        fields: [field('id')],
      }).success,
    ).toBe(false);
    expect(
      createLogicalModelFormSchema(['result'], 'result').safeParse({
        source: 'default',
        name: 'result',
        description: '',
        fields: [field('id')],
      }).success,
    ).toBe(true);
  });

  it('renders the optional top-level description immediately after name', () => {
    renderLogicalModelForm();

    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');

    expect(descriptionInput).toHaveAttribute(
      'placeholder',
      'Optional logical model description',
    );
    expect(screen.getAllByRole('textbox').slice(0, 2)).toEqual([
      nameInput,
      descriptionInput,
    ]);
  });

  it('keeps top-level and field descriptions untransformed in form state', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '  Model description  ',
      fields: [field('id', '  Field description  ')],
    });

    expect(result).toEqual({
      success: true,
      data: {
        source: 'default',
        name: 'result',
        description: '  Model description  ',
        fields: [field('id', '  Field description  ')],
      },
    });
  });

  it('retains the correct names and descriptions after removing a middle row', async () => {
    renderLogicalModelForm([
      field('first', 'First description'),
      field('middle', 'Middle description'),
      field('last', 'Last description'),
    ]);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Remove field 2' }));

    expect(screen.getByLabelText('Field 1 name')).toHaveValue('first');
    expect(screen.getByLabelText('Field 2 name')).toHaveValue('last');
    expect(screen.getByLabelText('Field 2 description')).toHaveValue(
      'Last description',
    );
    expect(
      screen.getAllByRole('combobox', { name: 'Type kind level 0' }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole('combobox', { name: 'Argument 1 type' }),
    ).not.toBeInTheDocument();
  });

  it('disables pristine edit saves and reports changes and reversions', async () => {
    const { onDirtyChange, unmount } = renderLogicalModelForm(
      [field('id', 'Identifier')],
      'result',
    );
    const user = new TestUserEvent();
    const description = screen.getByLabelText('Description');
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    await user.type(description, 'Changed');
    expect(save).toBeEnabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.clear(description);
    expect(save).toBeDisabled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('does not disable Create solely because the form is pristine', () => {
    renderLogicalModelForm();

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('submits successfully after removing the final field', async () => {
    const { onSubmit } = renderLogicalModelForm();
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Remove field 1' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'result', fields: [] }),
      expect.anything(),
    );
  });
});
