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
import CreateActionForm from './CreateActionForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

// CodeMirror loads a second copy of @codemirror/state under vitest, which
// breaks the real editor's instanceof checks. The repo convention is to mock
// the editor; this stand-in keeps the field editable + targetable by aria-label.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    readOnly,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

// react-hot-toast's Toaster reads window.matchMedia, which jsdom lacks. Without
// this the success/error toasts throw and the error boundary swallows the form.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

// Captures the body of the migration write. In local (non-platform) mode the
// dashboard writes through `/apis/migrate`; the metadata endpoint only serves
// the `export_metadata` read, so a write that lands there would 500.
let migrationBody: {
  name: string;
  up: Array<{ type: string; args: unknown }>;
  down: Array<{ type: string; args: unknown }>;
} | null = null;

const migrateHandler = http.post(
  `${HASURA_API_URL}/apis/migrate`,
  async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  },
);

const server = setupServer(
  createExportActionsMetadataHandler({ actions: [], customTypes: {} }),
  migrateHandler,
);

const WEBHOOK = 'https://example.com/my-handler';

// The dirty-guard confirmation is owned by the DialogProvider; this is the
// message it renders (see DialogProvider.test.tsx).
const DIRTY_MESSAGE =
  'You have unsaved local changes. Are you sure you want to discard them?';

const expectedCustomTypesArgs = {
  scalars: [],
  enums: [],
  input_objects: [
    {
      name: 'SampleInput',
      fields: [
        { name: 'username', type: 'String!' },
        { name: 'password', type: 'String!' },
      ],
    },
  ],
  objects: [
    {
      name: 'SampleOutput',
      fields: [{ name: 'accessToken', type: 'String!' }],
    },
  ],
};

const expectedCreateActionArgs = {
  name: 'actionName',
  definition: {
    handler: WEBHOOK,
    output_type: 'SampleOutput',
    arguments: [{ name: 'arg1', type: 'SampleInput!' }],
    type: 'mutation',
    kind: 'synchronous',
    headers: [],
    forward_client_headers: false,
    timeout: 30,
  },
};

async function fillWebhook(user: TestUserEvent) {
  const webhook = await screen.findByPlaceholderText(/my-handler/i);
  await user.type(webhook, WEBHOOK);

  return webhook;
}

function submitActionForm() {
  const form = document.getElementById('action-form');
  if (!form) {
    throw new Error('expected the action form to be in the document');
  }
  fireEvent.submit(form);
}

describe('CreateActionForm', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    migrationBody = null;
    mocks.push.mockClear();
    queryClient.clear();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      asPath: '/orgs/xyz/projects/test-project/graphql/actions',
      isReady: true,
      query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
      push: mocks.push,
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
    // react-hot-toast keeps a module-global store; clear it so toasts from one
    // test don't bleed into the next.
    toast.remove();
  });

  afterAll(() => server.close());

  it('submits create_action with set_custom_types built from the form, then navigates on success', async () => {
    const user = new TestUserEvent();
    render(<CreateActionForm />);

    await fillWebhook(user);
    submitActionForm();

    await waitFor(() => expect(migrationBody).not.toBeNull());

    expect(migrationBody?.name).toBe('create_action_actionName');
    expect(migrationBody?.up).toEqual([
      { type: 'set_custom_types', args: expectedCustomTypesArgs },
      { type: 'create_action', args: expectedCreateActionArgs },
    ]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/orgs/xyz/projects/test-project/graphql/actions/actionName',
      ),
    );

    expect(
      await screen.findByText('The action has been created successfully.'),
    ).toBeInTheDocument();
  });

  it('shows an error and does not navigate when the migration request fails', async () => {
    server.use(
      http.post(`${HASURA_API_URL}/apis/migrate`, () =>
        HttpResponse.json(
          { error: 'migration rejected by server' },
          { status: 500 },
        ),
      ),
    );

    const user = new TestUserEvent();
    render(<CreateActionForm />);

    await fillWebhook(user);
    submitActionForm();

    expect(
      await screen.findByText('migration rejected by server'),
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('keeps the submit button disabled until the form is dirty', async () => {
    const user = new TestUserEvent();
    render(<CreateActionForm />);

    const createButton = await screen.findByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();

    const webhook = await screen.findByPlaceholderText(/my-handler/i);
    await user.type(webhook, WEBHOOK);

    await waitFor(() => expect(createButton).toBeEnabled());
  });

  describe('discard changes', () => {
    it('prompts to discard when cancelling with unsaved changes', async () => {
      const user = new TestUserEvent();
      render(<CreateActionForm />);

      await fillWebhook(user);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.getByText(DIRTY_MESSAGE)).toBeInTheDocument(),
      );
      expect(migrationBody).toBeNull();
    });

    it('closes without prompting when there are no unsaved changes', async () => {
      const user = new TestUserEvent();
      render(<CreateActionForm />);

      await screen.findByPlaceholderText(/my-handler/i);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText(DIRTY_MESSAGE)).not.toBeInTheDocument();
    });

    it('dismisses the prompt after confirming Discard', async () => {
      const user = new TestUserEvent();
      render(<CreateActionForm />);

      await fillWebhook(user);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await screen.findByText(DIRTY_MESSAGE);

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      await waitFor(() =>
        expect(screen.queryByText(DIRTY_MESSAGE)).not.toBeInTheDocument(),
      );
    });
  });
});
