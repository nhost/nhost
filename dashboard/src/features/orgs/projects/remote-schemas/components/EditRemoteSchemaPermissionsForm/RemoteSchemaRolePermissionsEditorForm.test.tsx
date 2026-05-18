import {
  buildSchema,
  getIntrospectionQuery,
  graphqlSync,
  type IntrospectionQuery,
  parse,
} from 'graphql';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import RemoteSchemaRolePermissionsEditorForm from './RemoteSchemaRolePermissionsEditorForm';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const fixtureSchema = buildSchema(`
  enum TestState { RED GREEN BLUE YELLOW PURPLE }
  scalar uuid

  type Query {
    field_with_nullable_enum(state: TestState): String
    field_with_required_enum(state: TestState!): String
    field_with_nullable_boolean(force: Boolean): String
    field_with_required_string(name: String!): String
    field_with_nullable_string(name: String): String
    field_with_int(count: Int): String
    field_with_float(pi: Float): String
    field_with_uuid(uid: uuid): String
    field_with_string_list(roles: [String!]): String
  }
`);

const introspectionResult = graphqlSync({
  schema: fixtureSchema,
  source: getIntrospectionQuery(),
}) as unknown as { data: IntrospectionQuery };

interface MigrationStep {
  type: string;
  args?: {
    definition?: { schema?: string };
    remote_schema?: string;
    role?: string;
    [key: string]: unknown;
  };
}
interface MigrationBody {
  up?: MigrationStep[];
  down?: MigrationStep[];
}

let capturedMigrations: MigrationBody[] = [];

const metadataHandler = http.post(
  'https://local.hasura.local.nhost.run/v1/metadata',
  async ({ request }) => {
    const body = (await request.json()) as { type: string };
    if (body.type === 'export_metadata') {
      return HttpResponse.json({
        metadata: { version: 3, sources: [] },
        resource_version: 1,
      });
    }
    if (body.type === 'introspect_remote_schema') {
      return HttpResponse.json({ data: introspectionResult.data });
    }
    return HttpResponse.json(
      { error: `Unhandled metadata type in test fixture: ${body.type}` },
      { status: 500 },
    );
  },
);

const migrateHandler = http.post(
  'https://local.hasura.local.nhost.run/apis/migrate',
  async ({ request }) => {
    const body = (await request.json()) as MigrationBody;
    capturedMigrations.push(body);
    return HttpResponse.json({ message: 'success' });
  },
);

const server = setupServer(
  tokenQuery,
  getProjectQuery,
  metadataHandler,
  migrateHandler,
);

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useGetRolesPermissionsQuery: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetRolesPermissionsQuery: mocks.useGetRolesPermissionsQuery,
  };
});

const REMOTE_SCHEMA_NAME = 'fixture_remote';
const TEST_ROLE = 'user';

interface RenderArgs {
  permission?: { definition: { schema: string } } | null;
  onSubmit?: () => void;
  onCancel?: () => void;
}

function renderForm({
  permission = null,
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
}: RenderArgs = {}) {
  return render(
    <RemoteSchemaRolePermissionsEditorForm
      remoteSchemaName={REMOTE_SCHEMA_NAME}
      role={TEST_ROLE}
      permission={permission as never}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
}

function permissionForField(fieldDeclaration: string) {
  return {
    definition: {
      schema: `
        scalar uuid
        enum TestState { RED GREEN BLUE YELLOW PURPLE }
        schema { query: Query }
        type Query { ${fieldDeclaration} }
      `,
    },
  };
}

async function expandAccordion(user: TestUserEvent, fieldName: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(fieldName) }));
}

async function openLiteralMenu(user: TestUserEvent) {
  await user.click(
    screen.getByRole('button', { name: 'Insert preset expression' }),
  );
}

async function clickSaveAndWaitForRequest(user: TestUserEvent) {
  await waitFor(() => expect(screen.queryAllByRole('menu')).toHaveLength(0));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save Permissions' }),
    ).not.toBeDisabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Save Permissions' }));
  await waitFor(() => expect(capturedMigrations).toHaveLength(1));
}

function lastSavedSDL(): string {
  expect(capturedMigrations).toHaveLength(1);
  const last = capturedMigrations[0];
  const addStep = last.up?.find(
    (step) => step.type === 'add_remote_schema_permissions',
  );
  expect(addStep).toBeDefined();
  const sdl = addStep!.args?.definition?.schema;
  expect(typeof sdl).toBe('string');
  expect(() => parse(sdl as string)).not.toThrow();
  return sdl as string;
}

describe('RemoteSchemaRolePermissionsEditorForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    capturedMigrations = [];
    mockPointerEvent();
    mocks.useGetRolesPermissionsQuery.mockReturnValue({});
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/xyz/projects/test-project',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: '/orgs/xyz/projects/test-project',
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
      query: {
        orgSlug: 'xyz',
        appSubdomain: 'test-project',
      },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      forward: vi.fn(),
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('Insert-literal menu visibility per arg type', () => {
    it('nullable enum: null + enum + permission vars; no "" / true / false', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_enum(state: TestState): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_enum');
      await expandAccordion(user, 'field_with_nullable_enum');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: 'null' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Enum values/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Permission variables/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /empty string/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'true' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'false' }),
      ).not.toBeInTheDocument();
    });

    it('non-null enum: enum + permission vars; no null / "" / true / false', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_required_enum(state: TestState!): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_required_enum');
      await expandAccordion(user, 'field_with_required_enum');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: /Enum values/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Permission variables/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'null' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /empty string/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'true' }),
      ).not.toBeInTheDocument();
    });

    it('non-null String: "" + permission vars; no null / true / false / enum', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_required_string(name: String!): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_required_string');
      await expandAccordion(user, 'field_with_required_string');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: /empty string/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Permission variables/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'null' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'true' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /Enum values/ }),
      ).not.toBeInTheDocument();
    });

    it('nullable Boolean: null + true/false + permission vars; no "" / enum', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_boolean(force: Boolean): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_boolean');
      await expandAccordion(user, 'field_with_nullable_boolean');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: 'null' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: 'true' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: 'false' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Permission variables/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /empty string/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /Enum values/ }),
      ).not.toBeInTheDocument();
    });

    it('nullable String: null + "" + permission vars; no true/false / enum', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_string(name: String): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_string');
      await expandAccordion(user, 'field_with_nullable_string');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: 'null' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /empty string/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /Permission variables/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'true' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /Enum values/ }),
      ).not.toBeInTheDocument();
    });

    it('list of strings: hides scalar literals and permission variables (only null is offered)', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_string_list(roles: [String!]): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_string_list');
      await expandAccordion(user, 'field_with_string_list');
      await openLiteralMenu(user);

      expect(
        await screen.findByRole('menuitem', { name: 'null' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /empty string/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'true' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'false' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /Enum values/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: /Permission variables/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Selected presets are serialized as the correct GraphQL literal', () => {
    it('typing "5431" on Int field emits unquoted integer literal', async () => {
      renderForm({
        permission: permissionForField('field_with_int(count: Int): String'),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');
      await expandAccordion(user, 'field_with_int');

      const input = screen.getByPlaceholderText('preset value');
      await user.clear(input);
      await user.type(input, '5431');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/count\s*:\s*Int\s*@preset\(value:\s*5431\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"5431"\s*\)/);
    });

    it('typing "3.14" on Float field emits unquoted float literal', async () => {
      renderForm({
        permission: permissionForField('field_with_float(pi: Float): String'),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_float');
      await expandAccordion(user, 'field_with_float');

      const input = screen.getByPlaceholderText('preset value');
      await user.clear(input);
      await user.type(input, '3.14');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/pi\s*:\s*Float\s*@preset\(value:\s*3\.14\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"3\.14"\s*\)/);
    });

    it('picking `true` from dropdown on Boolean field emits unquoted true', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_boolean(force: Boolean): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_boolean');
      await expandAccordion(user, 'field_with_nullable_boolean');
      await openLiteralMenu(user);

      await user.click(await screen.findByRole('menuitem', { name: 'true' }));

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/force\s*:\s*Boolean\s*@preset\(value:\s*true\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"true"\s*\)/);
    });

    it('picking `null` on nullable Boolean emits unquoted null', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_boolean(force: Boolean): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_boolean');
      await expandAccordion(user, 'field_with_nullable_boolean');
      await openLiteralMenu(user);

      await user.click(await screen.findByRole('menuitem', { name: 'null' }));

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/force\s*:\s*Boolean\s*@preset\(value:\s*null\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"null"\s*\)/);
    });

    it('picking `null` on nullable String emits unquoted null', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_string(name: String): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_string');
      await expandAccordion(user, 'field_with_nullable_string');
      await openLiteralMenu(user);

      await user.click(await screen.findByRole('menuitem', { name: 'null' }));

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/name\s*:\s*String\s*@preset\(value:\s*null\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"null"\s*\)/);
    });

    it('typing enum value name on enum field emits unquoted enum literal', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_enum(state: TestState): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_enum');
      await expandAccordion(user, 'field_with_nullable_enum');

      const input = screen.getByPlaceholderText('preset value');
      await user.clear(input);
      await user.type(input, 'GREEN');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(
        /state\s*:\s*TestState\s*@preset\(value:\s*GREEN\s*\)/,
      );
      expect(sdl).not.toMatch(/@preset\(value:\s*"GREEN"\s*\)/);
    });

    it('typing permission variable on String emits quoted X-Hasura-* literal', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_required_string(name: String!): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_required_string');
      await expandAccordion(user, 'field_with_required_string');

      const input = screen.getByPlaceholderText('preset value');
      await user.clear(input);
      await user.type(input, 'X-Hasura-User-Id');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(
        /name\s*:\s*String!\s*@preset\(value:\s*"X-Hasura-User-Id"\s*\)/,
      );
    });

    it('typing plain string on String emits quoted string literal', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_required_string(name: String!): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_required_string');
      await expandAccordion(user, 'field_with_required_string');

      const input = screen.getByPlaceholderText('preset value');
      await user.clear(input);
      await user.type(input, 'hello');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(
        /name\s*:\s*String!\s*@preset\(value:\s*"hello"\s*\)/,
      );
    });

    it('picking `""` on nullable String emits empty-string literal', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_string(name: String): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_string');
      await expandAccordion(user, 'field_with_nullable_string');
      await openLiteralMenu(user);

      await user.click(
        await screen.findByRole('menuitem', { name: /empty string/ }),
      );

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/name\s*:\s*String\s*@preset\(value:\s*""\s*\)/);
    });
  });

  describe('Round-trip — open existing permission and save without edits', () => {
    it('enum preset is preserved on no-op save', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_required_enum(state: TestState! @preset(value: BLUE)): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_required_enum');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(
        /state\s*:\s*TestState!\s*@preset\(value:\s*BLUE\s*\)/,
      );
    });

    it('bare null on nullable String round-trips unquoted on no-op save', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_nullable_string(name: String @preset(value: null)): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_nullable_string');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/name\s*:\s*String\s*@preset\(value:\s*null\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"null"\s*\)/);
    });

    it('Clear preset is hidden when no preset is set', async () => {
      renderForm({
        permission: permissionForField('field_with_int(count: Int): String'),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');
      await expandAccordion(user, 'field_with_int');
      await openLiteralMenu(user);

      await screen.findByRole('menuitem', { name: /Permission variables/ });
      expect(
        screen.queryByRole('menuitem', { name: /Clear preset/ }),
      ).not.toBeInTheDocument();
    });

    it('Clear preset strips the @preset directive from the saved SDL', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_int(count: Int @preset(value: 5431)): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');
      await expandAccordion(user, 'field_with_int');

      expect(screen.getByPlaceholderText('preset value')).toHaveValue('5431');

      await openLiteralMenu(user);
      await user.click(
        await screen.findByRole('menuitem', { name: /Clear preset/ }),
      );

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).not.toMatch(/@preset/);
      expect(sdl).toMatch(/field_with_int/);
    });

    it('legacy quoted Int preset is normalized to unquoted on no-op save', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_int(count: Int @preset(value: "5431")): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(/count\s*:\s*Int\s*@preset\(value:\s*5431\s*\)/);
      expect(sdl).not.toMatch(/@preset\(value:\s*"5431"\s*\)/);
    });
  });

  describe('Create permission from scratch', () => {
    it('checking a field expands its accordion and saving emits the typed preset', async () => {
      renderForm();
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');

      const checkbox = screen.getByRole('checkbox', {
        name: 'field_with_int',
      });
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await screen.findByText('Arguments:');

      await user.type(screen.getByPlaceholderText('preset value'), '42');

      await clickSaveAndWaitForRequest(user);
      const sdl = lastSavedSDL();
      expect(sdl).toMatch(
        /field_with_int.*count\s*:\s*Int\s*@preset\(value:\s*42\s*\)/s,
      );
    });
  });

  describe('Delete permission', () => {
    it('confirming the Delete dialog sends a drop_remote_schema_permissions migration', async () => {
      renderForm({
        permission: permissionForField(
          'field_with_int(count: Int @preset(value: 5431)): String',
        ),
      });
      const user = new TestUserEvent();
      await screen.findByText('field_with_int');

      await user.click(
        screen.getByRole('button', { name: 'Delete Permissions' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(capturedMigrations).toHaveLength(1));
      const step = capturedMigrations[0].up?.[0];
      expect(step?.type).toBe('drop_remote_schema_permissions');
      expect(step?.args?.remote_schema).toBe(REMOTE_SCHEMA_NAME);
      expect(step?.args?.role).toBe(TEST_ROLE);
    });
  });
});
