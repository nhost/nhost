import { createElement } from 'react';
import {
  BaseNativeQueryForm,
  createNativeQueryFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value?: string }) =>
    createElement('div', {
      'data-testid': 'sql-editor',
      'data-value': value,
    }),
}));

const values: NativeQueryFormValues = {
  source: 'default',
  rootFieldName: 'search_authors',
  description: 'Search authors',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [
    { name: 'search', type: 'text', nullable: false, description: '' },
  ],
};

function renderForm(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const result = render(
    createElement(BaseNativeQueryForm, {
      values,
      existingNames: [],
      logicalModelNames: ['author_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
      ...overrides,
    }),
  );

  return { ...result, onSubmit };
}

describe('createNativeQueryFormSchema', () => {
  it.each([
    [{ ...values, rootFieldName: '' }, ['rootFieldName']],
    [{ ...values, code: ' ' }, ['code']],
    [{ ...values, returns: '' }, ['returns']],
  ])('requires each core value', (input, path) => {
    const result = createNativeQueryFormSchema([]).safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path }),
      );
    }
  });

  it('rejects duplicate arguments and a new root-field collision', () => {
    const result = createNativeQueryFormSchema(['search_authors']).safeParse({
      ...values,
      arguments: [...values.arguments, { ...values.arguments[0] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['rootFieldName'] }),
          expect.objectContaining({
            path: ['arguments', 1, 'name'],
            message: 'Argument names must be unique.',
          }),
        ]),
      );
    }

    expect(
      createNativeQueryFormSchema(
        ['search_authors'],
        'search_authors',
      ).safeParse(values).success,
    ).toBe(true);
  });

  it('rejects unavailable source-local return models', () => {
    const result = createNativeQueryFormSchema(
      [],
      undefined,
      ['analytics'],
      ['analytics_result'],
    ).safeParse(values);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['source'] }),
          expect.objectContaining({ path: ['returns'] }),
        ]),
      );
    }
  });
});

describe('BaseNativeQueryForm', () => {
  it('associates an argument-type error with its exact trigger', async () => {
    renderForm({
      values: {
        ...values,
        arguments: [
          { name: 'search', type: '', nullable: false, description: '' },
        ],
      },
    });

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Create' }),
    );

    const trigger = screen.getByRole('combobox', { name: 'Argument 1 type' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription(
      'Select or enter an argument type.',
    );
  });

  it('clears returns on source change and submits the chosen source', async () => {
    const onSourceChange = vi.fn();
    const { onSubmit } = renderForm({
      logicalModelNames: ['author_result', 'analytics_result'],
      sourceOptions: ['default', 'analytics'],
      onSourceChange,
    });
    const user = new TestUserEvent();

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');
    expect(onSourceChange).toHaveBeenCalledWith('analytics');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveTextContent('Select a logical model');

    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'analytics_result' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'analytics',
          returns: 'analytics_result',
        }),
        expect.anything(),
      ),
    );
  });

  it('revalidates source and return membership when options change', async () => {
    const baseProps = {
      values,
      existingNames: [] as string[],
      sourceOptions: ['default'],
      logicalModelNames: ['author_result'],
      isPending: false,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(createElement(BaseNativeQueryForm, baseProps));

    rerender(
      createElement(BaseNativeQueryForm, {
        ...baseProps,
        sourceOptions: [],
        logicalModelNames: [],
      }),
    );

    expect(
      await screen.findByText('The selected data source is unavailable.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('The selected logical model is unavailable.'),
    ).toBeInTheDocument();
  });
});
