import { createElement } from 'react';
import { vi } from 'vitest';
import NativeQueryForm, {
  createNativeQueryFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForm';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

vi.mock('@uiw/react-codemirror', () => ({ default: () => null }));

const valid = {
  source: 'default',
  rootFieldName: 'search_authors',
  description: '  Search authors  ',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [
    { name: 'search', type: 'text', nullable: false, description: '' },
  ],
};

function renderNativeQueryForm(argumentValues = valid.arguments) {
  const onSubmit = vi.fn();
  const result = render(
    createElement(NativeQueryForm, {
      resetToken: 'test',
      values: { ...valid, arguments: argumentValues },
      existingNames: [],
      logicalModelNames: ['author_result'],
      sourceOptions: ['default'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
    }),
  );

  return { ...result, onSubmit };
}

describe('createNativeQueryFormSchema', () => {
  it.each([
    [{ ...valid, rootFieldName: '' }, 'Root field name is required.'],
    [{ ...valid, code: '  ' }, 'SQL is required.'],
    [{ ...valid, returns: '' }, 'Select a return model.'],
  ])('requires the core native query fields', (values, message) => {
    const result = createNativeQueryFormSchema([]).safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(message);
    }
  });

  it('rejects duplicate argument names', () => {
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      arguments: [...valid.arguments, { ...valid.arguments[0] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === 'Argument names must be unique.',
        ),
      ).toBe(true);
    }
  });

  it('rejects collisions but permits an unchanged name while editing', () => {
    expect(
      createNativeQueryFormSchema(['search_authors']).safeParse(valid).success,
    ).toBe(false);
    expect(
      createNativeQueryFormSchema(
        ['search_authors'],
        'search_authors',
      ).safeParse(valid).success,
    ).toBe(true);
  });

  it('requires a stable top-level description string without transforming it', () => {
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        description: undefined,
      }).success,
    ).toBe(false);
    expect(createNativeQueryFormSchema([]).safeParse(valid)).toEqual({
      success: true,
      data: valid,
    });
  });

  it('requires stable argument-description strings without transforming them', () => {
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        arguments: [{ ...valid.arguments[0], description: undefined }],
      }).success,
    ).toBe(false);
    expect(
      createNativeQueryFormSchema([]).safeParse({
        ...valid,
        arguments: [
          { ...valid.arguments[0], description: '  Search phrase  ' },
        ],
      }),
    ).toEqual({
      success: true,
      data: {
        ...valid,
        arguments: [
          { ...valid.arguments[0], description: '  Search phrase  ' },
        ],
      },
    });
  });

  it('renders the optional single-line Description input immediately after the root field name', () => {
    renderNativeQueryForm();

    const rootFieldName = screen.getByLabelText('Root field name');
    const description = screen.getByLabelText('Description');

    expect(description.tagName).toBe('INPUT');
    expect(description).toHaveAttribute(
      'placeholder',
      'Optional native query description',
    );
    expect(description).toHaveValue('  Search authors  ');
    expect(
      rootFieldName.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('retains the correct argument values after removing a middle row', async () => {
    renderNativeQueryForm([
      { name: 'first', type: 'text', nullable: false, description: 'First' },
      { name: 'middle', type: 'uuid', nullable: true, description: 'Middle' },
      { name: 'last', type: 'integer', nullable: false, description: 'Last' },
    ]);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Remove argument 2' }),
    );

    expect(screen.getByLabelText('Argument 1 name')).toHaveValue('first');
    expect(screen.getByLabelText('Argument 2 name')).toHaveValue('last');
    expect(screen.getByLabelText('Argument 2 description')).toHaveValue('Last');
    expect(
      screen.getByRole('combobox', { name: 'Argument 2 type' }),
    ).toHaveTextContent('integer');
    expect(
      screen.queryByRole('combobox', { name: 'Type kind level 0' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Arguments' })).toHaveAttribute(
      'data-layout',
      'flow',
    );
  });

  it('submits successfully with zero arguments', async () => {
    const { onSubmit } = renderNativeQueryForm([]);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Save native query' }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '  Search authors  ',
          arguments: [],
        }),
        expect.anything(),
      ),
    );
  });
});
