import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createElement } from 'react';
import {
  BaseLogicalModelForm,
  createLogicalModelFormSchema,
} from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

Element.prototype.scrollIntoView = vi.fn();

const scalarField = (
  name: string,
): LogicalModelFormValues['fields'][number] => ({
  name,
  type: { kind: 'scalar', scalar: 'text', nullable: false },
  description: '',
});

const values: LogicalModelFormValues = {
  name: 'result',
  description: '',
  fields: [scalarField('id')],
};

function metadataFixture(
  sources: { name: string; models: string[] }[],
): ExportMetadataResponse {
  return {
    resource_version: 1,
    metadata: {
      version: 3,
      sources: sources.map(({ name, models }) => ({
        name,
        kind: 'postgres',
        tables: [],
        native_queries: [],
        logical_models: models.map((modelName) => ({
          name: modelName,
          fields: [{ name: 'id', type: { scalar: 'text', nullable: false } }],
        })),
      })),
    },
  };
}

const serverMetadata = metadataFixture([
  { name: 'default', models: ['related_result', 'default_result'] },
  { name: 'analytics', models: ['analytics_result'] },
]);

describe('createLogicalModelFormSchema', () => {
  it('reports required recursive fields at their exact paths', async () => {
    const result = await createLogicalModelFormSchema().safeParseAsync({
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

  it('rejects duplicate field names', async () => {
    const result = await createLogicalModelFormSchema().safeParseAsync({
      ...values,
      fields: [scalarField('id'), scalarField('id')],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['fields', 1, 'name'],
          message: 'Field names must be unique.',
        }),
      );
    }
  });
});

function renderForm(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const result = render(
    createElement(BaseLogicalModelForm, {
      values,
      logicalModelNames: ['related_result'],
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

describe('BaseLogicalModelForm', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterAll(() => server.close());
  beforeEach(() => queryClient.clear());

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
});
