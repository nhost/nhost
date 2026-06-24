import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  fireEvent,
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type {
  ActionItem,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import EditActionRelationshipsForm from './EditActionRelationshipsForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => ({ data: ['default'] }),
}));

vi.mock('@/features/orgs/projects/common/hooks/useMetadataTables', () => ({
  useMetadataTables: () => [
    { source: 'default', schema: 'public', table: 'animals' },
  ],
}));

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: () => ({
      data: {
        columns: [{ column_name: 'user_id' }, { column_name: 'created_at' }],
      },
    }),
  }),
);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const relationshipAction: ActionItem = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com/rates',
    output_type: 'ExchangeRatesOutput',
    arguments: [],
    type: 'query',
    timeout: 30,
    headers: [],
  },
};

const relationshipCustomTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [],
  objects: [
    {
      name: 'ExchangeRatesOutput',
      fields: [
        { name: 'base', type: 'String!' },
        { name: 'lastUpdated', type: 'String!' },
      ],
      relationships: [
        {
          source: 'default',
          name: 'animal',
          type: 'object',
          remote_table: { schema: 'public', name: 'animals' },
          field_mapping: { lastUpdated: 'created_at' },
          // biome-ignore lint/suspicious/noExplicitAny: test fixture
        } as any,
      ],
    },
  ],
};

const cleanCustomTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [],
  objects: [
    {
      name: 'ExchangeRatesOutput',
      fields: [
        { name: 'base', type: 'String!' },
        { name: 'lastUpdated', type: 'String!' },
      ],
    },
  ],
};

const scalarOutputAction: ActionItem = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com/rates',
    output_type: 'String',
    arguments: [],
    type: 'query',
    timeout: 30,
    headers: [],
  },
};

let migrationBody: {
  name: string;
  up: Array<{ type: string; args: Record<string, unknown> }>;
} | null = null;

const server = setupServer(
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

describe('EditActionRelationshipsForm', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    migrationBody = null;
    // The export-metadata query is cached by subdomain on a shared client; clear it so each test sees its own fixture.
    queryClient.clear();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      asPath:
        '/orgs/xyz/projects/test-project/graphql/actions/getExchangeRates',
      isReady: true,
      query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
    });
  });

  afterEach(() => {
    server.resetHandlers();
    toast.remove();
  });

  afterAll(() => server.close());

  it('warns when the action output type is not an object type', async () => {
    server.use(
      createExportActionsMetadataHandler({
        actions: [scalarOutputAction],
        customTypes: {},
      }),
    );

    render(<EditActionRelationshipsForm actionName="getExchangeRates" />);

    expect(
      await screen.findByText(/is not an object type/i),
    ).toBeInTheDocument();
  });

  it('renders the existing relationships of the output object type', async () => {
    server.use(
      createExportActionsMetadataHandler({
        actions: [relationshipAction],
        customTypes: relationshipCustomTypes,
      }),
    );

    render(<EditActionRelationshipsForm actionName="getExchangeRates" />);

    // The name renders via TextWithTooltip (which can split the text), so key off the row's delete-button testid.
    expect(
      await screen.findByTestId('delete-action-rel-animal'),
    ).toBeInTheDocument();
    expect(screen.getByText('public.animals')).toBeInTheDocument();
    expect(screen.getByText('lastUpdated → created_at')).toBeInTheDocument();
  });

  it('removes a relationship via set_custom_types without the deleted relationship', async () => {
    server.use(
      createExportActionsMetadataHandler({
        actions: [relationshipAction],
        customTypes: relationshipCustomTypes,
      }),
    );

    const user = new TestUserEvent();
    render(<EditActionRelationshipsForm actionName="getExchangeRates" />);

    await user.click(await screen.findByTestId('delete-action-rel-animal'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe(
      'remove_action_relationship_animal_from_ExchangeRatesOutput',
    );
    expect(migrationBody?.up[0].type).toBe('set_custom_types');
    expect(migrationBody?.up[0].args.objects).toEqual([
      {
        name: 'ExchangeRatesOutput',
        fields: [
          { name: 'base', type: 'String!' },
          { name: 'lastUpdated', type: 'String!' },
        ],
      },
    ]);
  });

  it('disables a source field already used by another mapping and the add button once all are mapped', async () => {
    server.use(
      createExportActionsMetadataHandler({
        actions: [relationshipAction],
        customTypes: cleanCustomTypes,
      }),
    );

    const user = new TestUserEvent();
    render(<EditActionRelationshipsForm actionName="getExchangeRates" />);

    await user.click(
      await screen.findByRole('button', { name: 'Relationship' }),
    );
    await screen.findByLabelText('Relationship Name');

    const addButton = screen.getByRole('button', { name: /Add New Mapping/i });
    await user.click(addButton); // row 0 defaults to the first unused field: base
    await user.click(addButton); // row 1 defaults to the next unused field: lastUpdated

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Add New Mapping/i }),
      ).toBeDisabled(),
    );

    await user.click(screen.getByTestId('fieldMapping.1.sourceField'));
    expect(await screen.findByRole('option', { name: 'base' })).toHaveAttribute(
      'data-disabled',
    );
    expect(
      screen.getByRole('option', { name: 'lastUpdated' }),
    ).not.toHaveAttribute('data-disabled');
  });

  it('persists every mapping when two source fields target the same reference column', async () => {
    server.use(
      createExportActionsMetadataHandler({
        actions: [relationshipAction],
        customTypes: cleanCustomTypes,
      }),
    );

    const user = new TestUserEvent();
    render(<EditActionRelationshipsForm actionName="getExchangeRates" />);

    await user.click(
      await screen.findByRole('button', { name: 'Relationship' }),
    );
    await screen.findByLabelText('Relationship Name');

    await user.type(screen.getByLabelText('Relationship Name'), 'animal');

    await user.click(screen.getByRole('combobox', { name: 'Schema' }));
    await user.click(await screen.findByRole('option', { name: 'public' }));
    await user.click(screen.getByRole('combobox', { name: 'Table' }));
    await user.click(await screen.findByRole('option', { name: 'animals' }));

    const addButton = screen.getByRole('button', { name: /Add New Mapping/i });
    await user.click(addButton); // base -> user_id (default reference column)
    await user.click(addButton); // lastUpdated -> user_id (same reference column)

    const submitButton = screen.getByRole('button', {
      name: 'Create Relationship',
    });
    fireEvent.submit(submitButton.closest('form')!);

    await waitFor(() => expect(migrationBody).not.toBeNull());

    const setCustomTypes = migrationBody?.up.find(
      (step) => step.type === 'set_custom_types',
    );
    const objects = (setCustomTypes?.args.objects ?? []) as Array<{
      name: string;
      relationships?: Array<{
        name: string;
        field_mapping: Record<string, string>;
      }>;
    }>;
    const relationship = objects
      .find((object) => object.name === 'ExchangeRatesOutput')
      ?.relationships?.find((rel) => rel.name === 'animal');

    expect(relationship?.field_mapping).toEqual({
      base: 'user_id',
      lastUpdated: 'user_id',
    });
  });
});
