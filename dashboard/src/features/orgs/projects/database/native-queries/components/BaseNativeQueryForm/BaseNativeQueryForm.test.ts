import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createElement } from 'react';
import {
  BaseNativeQueryForm,
  createNativeQueryFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value?: string }) =>
    createElement('div', {
      'data-testid': 'sql-editor',
      'data-value': value,
    }),
}));

const values: NativeQueryFormValues = {
  rootFieldName: 'search_authors',
  description: 'Search authors',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [
    { name: 'search', type: 'text', nullable: false, description: '' },
  ],
};

function metadataFixture(
  sources: { name: string; queries: string[]; models: string[] }[],
): ExportMetadataResponse {
  return {
    resource_version: 1,
    metadata: {
      version: 3,
      sources: sources.map(({ name, queries, models }) => ({
        name,
        kind: 'postgres',
        tables: [],
        native_queries: queries.map((rootFieldName) => ({
          root_field_name: rootFieldName,
          code: 'SELECT 1',
          returns: models[0] ?? '',
        })),
        logical_models: models.map((modelName) => ({
          name: modelName,
          fields: [{ name: 'id', type: { scalar: 'text', nullable: false } }],
        })),
      })),
    },
  };
}

const serverMetadata = metadataFixture([
  { name: 'default', queries: ['existing_query'], models: ['author_result'] },
  { name: 'analytics', queries: [], models: ['analytics_result'] },
]);

describe('createNativeQueryFormSchema', () => {
  it.each([
    [{ ...values, rootFieldName: '' }, ['rootFieldName']],
    [{ ...values, code: ' ' }, ['code']],
    [{ ...values, returns: '' }, ['returns']],
  ])('requires each core value', async (input, path) => {
    const result = await createNativeQueryFormSchema().safeParseAsync(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path }),
    );
  });

  it('rejects duplicate argument names', async () => {
    const result = await createNativeQueryFormSchema().safeParseAsync({
      ...values,
      arguments: [...values.arguments, { ...values.arguments[0] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['arguments', 1, 'name'],
          message: 'Argument names must be unique.',
        }),
      );
    }
  });
});

function renderForm(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const result = render(
    createElement(BaseNativeQueryForm, {
      values,
      logicalModelNames: ['author_result'],
      isPending: false,
      onSubmit,
      onCancel: vi.fn(),
      ...overrides,
    }),
  );

  return { ...result, onSubmit };
}

const server = setupServer(
  http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
    HttpResponse.json(serverMetadata),
  ),
);

describe('BaseNativeQueryForm', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());
  beforeEach(() => queryClient.clear());

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

  it('submits the selected return model', async () => {
    const { onSubmit } = renderForm({
      logicalModelNames: ['author_result', 'other_result'],
    });
    const user = new TestUserEvent();

    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'other_result' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ returns: 'other_result' }),
        expect.anything(),
      ),
    );
  });
});
