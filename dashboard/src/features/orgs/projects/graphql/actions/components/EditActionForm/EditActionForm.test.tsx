import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
  sampleMutationAction,
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
import EditActionForm from './EditActionForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

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

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

let migrationBody: {
  name: string;
  up: Array<{ type: string; args: unknown }>;
} | null = null;

const server = setupServer(
  createExportActionsMetadataHandler(),
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

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

function renderEditForm() {
  render(<EditActionForm action={sampleMutationAction} />);
}

async function waitForForm() {
  await screen.findByPlaceholderText(/my-handler/i);
}

// mockPointerEvent (needed for the form's Radix Select/dialog) defines
// window.PointerEvent, which stops userEvent.click from triggering native form
// submission in jsdom — so submit the form element directly.
function submitActionForm() {
  const form = document.getElementById('action-form');
  if (!form) {
    throw new Error('expected the action form to be in the document');
  }
  fireEvent.submit(form);
}

describe('EditActionForm', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    migrationBody = null;
    mocks.push.mockClear();
    queryClient.clear();
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      asPath: '/orgs/xyz/projects/test-project/graphql/actions/login',
      push: mocks.push,
    });
  });

  afterEach(() => {
    server.resetHandlers();
    toast.remove();
  });

  afterAll(() => server.close());

  it('populates the form from the action being edited', async () => {
    renderEditForm();
    await waitForForm();

    expect(screen.getByPlaceholderText(/my-handler/i)).toHaveValue(
      'https://example.com/login',
    );
    expect(
      screen.getByPlaceholderText(/statement to help describe/i),
    ).toHaveValue('Logs a user in');

    const definitionEditor = screen.getByLabelText(
      'Action Definition',
    ) as HTMLTextAreaElement;
    expect(definitionEditor.value).toContain(
      'login(credentials: SampleInput!): SampleOutput',
    );
  });

  it('submits update_action (preserving the name) with the edited fields', async () => {
    const user = new TestUserEvent();
    renderEditForm();
    await waitForForm();

    const comment = screen.getByPlaceholderText(/statement to help describe/i);
    await user.clear(comment);
    await user.type(comment, 'Updated comment');

    submitActionForm();

    await waitFor(() => expect(migrationBody).not.toBeNull());

    expect(migrationBody?.name).toBe('modify_action_login_to_login');
    expect(migrationBody?.up).toEqual([
      { type: 'set_custom_types', args: expectedCustomTypesArgs },
      {
        type: 'update_action',
        args: {
          name: 'login',
          comment: 'Updated comment',
          definition: {
            handler: 'https://example.com/login',
            output_type: 'SampleOutput',
            arguments: [{ name: 'credentials', type: 'SampleInput!' }],
            type: 'mutation',
            kind: 'synchronous',
            headers: [],
            forward_client_headers: false,
            timeout: 30,
          },
        },
      },
    ]);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/orgs/xyz/projects/test-project/graphql/actions/login',
      ),
    );
  });

  it('blocks renaming the action and does not send a request', async () => {
    const user = new TestUserEvent();
    renderEditForm();
    await waitForForm();

    const definitionEditor = screen.getByLabelText('Action Definition');
    await user.clear(definitionEditor);
    await user.paste(
      'type Mutation {\n  renamedAction(credentials: SampleInput!): SampleOutput\n}',
    );

    submitActionForm();

    expect(
      await screen.findByText(/Renaming an action is not supported/i),
    ).toBeInTheDocument();
    expect(migrationBody).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
