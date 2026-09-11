import { createElement } from 'react';
import {
  BaseLogicalModelForm,
  createLogicalModelFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { buildLogicalModelDTO } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

Element.prototype.scrollIntoView = vi.fn();

const field = (
  name: string,
  description = '',
): LogicalModelFormValues['fields'][number] => ({
  name,
  type: { kind: 'scalar', scalar: 'text', nullable: true },
  description,
});

function renderLogicalModelForm(
  fields: LogicalModelFormValues['fields'] = [field('id', 'Identifier')],
  originalName?: string,
) {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  const result = render(
    createElement(BaseLogicalModelForm, {
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

function renderDefaultLogicalModelForm() {
  return render(
    createElement(BaseLogicalModelForm, {
      existingNames: [],
      logicalModelNames: ['related_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    }),
  );
}

const validIdentifierCases = ['name', 'name123', '_leading'];
const invalidIdentifierCases = [
  ['', 'is required.'],
  [' ', 'must start with a letter or underscore.'],
  [' name', 'must start with a letter or underscore.'],
  ['name ', 'must contain only letters, numbers, or underscores.'],
  ['my-name!', 'must contain only letters, numbers, or underscores.'],
  ['1name', 'must start with a letter or underscore.'],
] as const;

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

  it.each(
    validIdentifierCases,
  )('passes the valid logical model name %j through to track args unchanged', (name) => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name,
      description: '',
      fields: [field('id')],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(buildLogicalModelDTO(result.data).args.name).toBe(name);
    }
  });

  it.each(
    validIdentifierCases,
  )('passes the valid logical model field name %j through to track args unchanged', (name) => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '',
      fields: [field(name)],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(buildLogicalModelDTO(result.data).args.fields[0]?.name).toBe(name);
    }
  });

  it.each(
    invalidIdentifierCases,
  )('rejects invalid logical model name %j before building track args', (name, message) => {
    const builder = vi.fn(buildLogicalModelDTO);
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name,
      description: '',
      fields: [field('id')],
    });

    if (result.success) {
      builder(result.data);
    }
    expect(result.success).toBe(false);
    expect(builder).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['name'],
          message: `Name ${message}`,
        }),
      );
    }
  });

  it.each(
    invalidIdentifierCases,
  )('rejects invalid logical model field name %j before building track args', (name, message) => {
    const builder = vi.fn(buildLogicalModelDTO);
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '',
      fields: [field(name)],
    });

    if (result.success) {
      builder(result.data);
    }
    expect(result.success).toBe(false);
    expect(builder).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['fields', 0, 'name'],
          message: `Field name ${message}`,
        }),
      );
    }
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

  it('starts initial and newly added fields as non-nullable', async () => {
    renderDefaultLogicalModelForm();
    const user = new TestUserEvent();

    expect(
      screen.getByRole('checkbox', { name: 'Field 1 nullable' }),
    ).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Add field' }));

    expect(
      screen.getByRole('checkbox', { name: 'Field 2 nullable' }),
    ).not.toBeChecked();
  });

  it('preserves unchecked nullability across kind switches', async () => {
    renderDefaultLogicalModelForm();
    const user = new TestUserEvent();
    const nullable = screen.getByRole('checkbox', {
      name: 'Field 1 nullable',
    });

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(nullable).not.toBeChecked();

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');
    expect(nullable).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 item nullable' }),
    ).not.toBeChecked();
  });

  it('preserves checked nullability across kind switches', async () => {
    renderLogicalModelForm();
    const user = new TestUserEvent();
    const nullable = screen.getByRole('checkbox', {
      name: 'Field 1 nullable',
    });

    expect(nullable).toBeChecked();
    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(nullable).toBeChecked();

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');
    expect(nullable).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 item nullable' }),
    ).not.toBeChecked();
  });

  it('keeps existing nullable fields checked and submits them unchanged', async () => {
    const { onSubmit } = renderLogicalModelForm([field('id')], 'result');
    const user = new TestUserEvent();

    expect(
      screen.getByRole('checkbox', { name: 'Field 1 nullable' }),
    ).toBeChecked();
    await user.type(screen.getByLabelText('Description'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: [field('id')],
        }),
        expect.anything(),
      ),
    );
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
    await user.click(screen.getByTestId('fields.1.description'));
    expect(screen.getByLabelText('Field 2 description')).toHaveValue(
      'Last description',
    );
    expect(
      screen.getAllByRole('combobox', { name: /Field [12] kind/ }),
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

  it('opens and closes a description without dirtying a pristine edit', async () => {
    renderLogicalModelForm([field('id', 'Identifier')], 'result');
    const user = new TestUserEvent();
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    const trigger = screen.getByRole('button', {
      name: 'Edit description',
    });
    await user.click(trigger);
    expect(screen.getByLabelText('Field 1 description')).toHaveValue(
      'Identifier',
    );
    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(save).toBeDisabled();
  });

  it('associates a nested type error only with its exact control', async () => {
    renderLogicalModelForm([
      {
        name: 'nested',
        description: '',
        type: {
          kind: 'array',
          nullable: true,
          item: {
            kind: 'array',
            nullable: true,
            item: {
              kind: 'logical_model',
              logicalModel: '',
              nullable: true,
            },
          },
        },
      },
    ]);
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    const error = await screen.findByText('Select a logical model.');
    const control = screen.getByRole('combobox', {
      name: 'Field 1 item item logical model',
    });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute(
      'aria-describedby',
      'logical-model-field-1-type-item-item-error',
    );
    expect(control).toHaveAccessibleDescription('Select a logical model.');
    expect(error).toHaveAttribute(
      'id',
      'logical-model-field-1-type-item-item-error',
    );
    expect(screen.getAllByText('Select a logical model.')).toHaveLength(1);
  });

  it('edits and submits two recursive array levels independently', async () => {
    const { onSubmit } = renderLogicalModelForm([field('nested')]);
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');
    screen.getByRole('combobox', { name: 'Field 1 item kind' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');
    screen.getByRole('combobox', { name: 'Field 1 item item kind' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await user.click(
      screen.getByRole('combobox', {
        name: 'Field 1 item item logical model',
      }),
    );
    await user.click(screen.getByRole('option', { name: 'related_result' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Field 1 nullable' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Field 1 item item nullable' }),
    );

    const itemGroups = screen.getAllByTestId('field-item-group');
    expect(itemGroups).toHaveLength(2);
    expect(screen.getAllByText('Item type')).toHaveLength(2);
    expect(screen.queryByText('Item type below')).not.toBeInTheDocument();
    expect(screen.queryByText(/^item$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/└/)).not.toBeInTheDocument();
    expect(itemGroups[1]?.parentElement?.parentElement).toBe(itemGroups[0]);
    expect(
      screen.getAllByRole('button', { name: /Remove field/ }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: /(Add|Edit) description/ }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 item nullable' }),
    ).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: [
            {
              name: 'nested',
              description: '',
              type: {
                kind: 'array',
                nullable: false,
                item: {
                  kind: 'array',
                  nullable: false,
                  item: {
                    kind: 'logical_model',
                    logicalModel: 'related_result',
                    nullable: true,
                  },
                },
              },
            },
          ],
        }),
        expect.anything(),
      ),
    );
  });

  it('does not disable Create solely because the form is pristine', () => {
    renderLogicalModelForm();

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('submits successfully after removing the final field', async () => {
    const { onSubmit } = renderLogicalModelForm();
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Remove field 1' }));
    expect(screen.queryByLabelText('Field 1 name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'result', fields: [] }),
      expect.anything(),
    );
  });

  it('rejects unavailable sources and source-local model references', () => {
    const result = createLogicalModelFormSchema(
      [],
      undefined,
      ['analytics'],
      ['analytics_result'],
    ).safeParse({
      source: 'missing',
      name: 'result',
      description: '',
      fields: [
        {
          name: 'nested',
          description: '',
          type: {
            kind: 'logical_model',
            logicalModel: 'default_result',
            nullable: false,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['source'] }),
          expect.objectContaining({
            path: ['fields', 0, 'type', 'logicalModel'],
          }),
        ]),
      );
    }
  });

  it('clears recursive model references on source change while preserving the draft shape', async () => {
    const onSubmit = vi.fn();
    const onSourceChange = vi.fn();
    render(
      createElement(BaseLogicalModelForm, {
        values: {
          source: 'default',
          name: 'result',
          description: 'Description',
          fields: [
            field('id'),
            {
              name: 'nested',
              description: 'Nested',
              type: {
                kind: 'array',
                nullable: true,
                item: {
                  kind: 'logical_model',
                  logicalModel: 'default_result',
                  nullable: true,
                },
              },
            },
          ],
        },
        existingNames: [],
        logicalModelNames: ['default_result', 'analytics_result'],
        sourceOptions: ['default', 'analytics'],
        isPending: false,
        onSubmit,
        onCancel: vi.fn(),
        onSourceChange,
      }),
    );
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');

    expect(onSourceChange).toHaveBeenCalledWith('analytics');
    expect(screen.getByLabelText('Name')).toHaveValue('result');
    expect(screen.getByLabelText('Description')).toHaveValue('Description');
    expect(
      screen.getByRole('checkbox', { name: 'Field 2 nullable' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Field 2 item nullable' }),
    ).toBeChecked();
    expect(
      screen.getByRole('combobox', {
        name: 'Field 2 item logical model',
      }),
    ).toHaveTextContent('Select a logical model');

    await user.click(
      screen.getByRole('combobox', {
        name: 'Field 2 item logical model',
      }),
    );
    await user.click(screen.getByRole('option', { name: 'analytics_result' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'analytics',
          fields: [
            field('id'),
            expect.objectContaining({
              type: {
                kind: 'array',
                nullable: true,
                item: {
                  kind: 'logical_model',
                  logicalModel: 'analytics_result',
                  nullable: true,
                },
              },
            }),
          ],
        }),
        expect.anything(),
      ),
    );
  });

  it('locks the source while a mutation is pending', () => {
    render(
      createElement(BaseLogicalModelForm, {
        values: {
          source: 'default',
          name: 'result',
          description: '',
          fields: [field('id')],
        },
        existingNames: [],
        logicalModelNames: [],
        sourceOptions: ['default', 'analytics'],
        isPending: true,
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toBeDisabled();
  });
});
