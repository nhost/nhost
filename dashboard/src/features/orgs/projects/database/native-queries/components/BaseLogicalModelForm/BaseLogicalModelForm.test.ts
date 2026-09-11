import { createElement } from 'react';
import {
  BaseLogicalModelForm,
  createLogicalModelFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

Element.prototype.scrollIntoView = vi.fn();

const scalarField = (
  name: string,
): LogicalModelFormValues['fields'][number] => ({
  name,
  type: { kind: 'scalar', scalar: 'text', nullable: false },
  description: '',
});

const values: LogicalModelFormValues = {
  source: 'default',
  name: 'result',
  description: '',
  fields: [scalarField('id')],
};

function renderForm(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const result = render(
    createElement(BaseLogicalModelForm, {
      values,
      existingNames: [],
      logicalModelNames: ['related_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
      ...overrides,
    }),
  );

  return { ...result, onSubmit };
}

describe('createLogicalModelFormSchema', () => {
  it('reports required recursive fields at their exact paths', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      ...values,
      name: '',
      fields: [
        {
          name: '',
          description: '',
          type: {
            kind: 'array',
            nullable: false,
            item: { kind: 'logical_model', logicalModel: '', nullable: false },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['name'] }),
          expect.objectContaining({ path: ['fields', 0, 'name'] }),
          expect.objectContaining({
            path: ['fields', 0, 'type', 'item', 'logicalModel'],
          }),
        ]),
      );
    }
  });

  it('rejects duplicate fields and unavailable source-local references', () => {
    const result = createLogicalModelFormSchema(
      [],
      undefined,
      ['analytics'],
      ['analytics_result'],
    ).safeParse({
      ...values,
      source: 'missing',
      fields: [
        scalarField('id'),
        {
          name: 'id',
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
            path: ['fields', 1, 'name'],
            message: 'Field names must be unique.',
          }),
          expect.objectContaining({
            path: ['fields', 1, 'type', 'logicalModel'],
          }),
        ]),
      );
    }
  });

  it('allows an unchanged edit name but rejects a new collision', () => {
    expect(
      createLogicalModelFormSchema(['result']).safeParse(values).success,
    ).toBe(false);
    expect(
      createLogicalModelFormSchema(['result'], 'result').safeParse(values)
        .success,
    ).toBe(true);
  });
});

describe('BaseLogicalModelForm', () => {
  it('associates a nested type error only with its exact control', async () => {
    renderForm({
      values: {
        ...values,
        fields: [
          {
            name: 'nested',
            description: '',
            type: {
              kind: 'array',
              nullable: false,
              item: {
                kind: 'logical_model',
                logicalModel: '',
                nullable: false,
              },
            },
          },
        ],
      },
    });

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Create' }),
    );

    const control = screen.getByRole('combobox', {
      name: 'Field 1 item logical model',
    });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Select a logical model.');
    expect(screen.getAllByText('Select a logical model.')).toHaveLength(1);
  });

  it('preserves nullability when switching kinds and submits the chosen type', async () => {
    const { onSubmit } = renderForm({
      values: {
        ...values,
        fields: [
          {
            ...scalarField('id'),
            type: { kind: 'scalar', scalar: 'text', nullable: true },
          },
        ],
      },
    });
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Field 1 kind' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(
      screen.getByRole('checkbox', { name: 'Field 1 nullable' }),
    ).toBeChecked();
    await user.click(
      screen.getByRole('combobox', { name: 'Field 1 logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'related_result' }));

    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: [
            expect.objectContaining({
              type: {
                kind: 'logical_model',
                logicalModel: 'related_result',
                nullable: true,
              },
            }),
          ],
        }),
        expect.anything(),
      ),
    );
  });

  it('clears recursive logical-model references when the source changes', async () => {
    const onSourceChange = vi.fn();
    renderForm({
      values: {
        ...values,
        fields: [
          {
            name: 'nested',
            description: '',
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
      logicalModelNames: ['default_result', 'analytics_result'],
      sourceOptions: ['default', 'analytics'],
      onSourceChange,
    });
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');

    expect(onSourceChange).toHaveBeenCalledWith('analytics');
    expect(
      screen.getByRole('combobox', { name: 'Field 1 item logical model' }),
    ).toHaveTextContent('Select a logical model');
  });
});
