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
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import CustomTypesEditor from './CustomTypesEditor';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
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
  up: Array<{ type: string; args: Record<string, unknown> }>;
} | null = null;

const server = setupServer(
  createExportActionsMetadataHandler(),
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

async function renderInitializedEditor() {
  render(<CustomTypesEditor />);
  const editor = (await screen.findByLabelText(
    'Custom types SDL editor',
  )) as HTMLTextAreaElement;
  await waitFor(() => expect(editor.value).toContain('SampleInput'));
  return editor;
}

describe('CustomTypesEditor', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    migrationBody = null;
    queryClient.clear();
  });

  afterEach(() => {
    server.resetHandlers();
    toast.remove();
  });

  afterAll(() => server.close());

  it('saves parsed custom types via set_custom_types', async () => {
    const user = new TestUserEvent();
    const editor = await renderInitializedEditor();

    await user.clear(editor);
    await user.paste('input SampleInput {\n  username: String!\n}');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(migrationBody).not.toBeNull());
    expect(migrationBody?.name).toBe('update_custom_types');
    expect(migrationBody?.up[0].type).toBe('set_custom_types');
    expect(migrationBody?.up[0].args.input_objects).toEqual([
      { name: 'SampleInput', fields: [{ name: 'username', type: 'String!' }] },
    ]);
  });

  it('shows a parse error and does not send a request for invalid SDL', async () => {
    const user = new TestUserEvent();
    const editor = await renderInitializedEditor();

    await user.clear(editor);
    await user.paste('interface Foo {\n  id: ID\n}');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Interface types are not supported'),
    ).toBeInTheDocument();
    expect(migrationBody).toBeNull();
  });

  it('reverts unsaved edits and disables the action buttons again', async () => {
    const user = new TestUserEvent();
    const editor = await renderInitializedEditor();
    const initialValue = editor.value;

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Revert changes' }),
    ).toBeDisabled();

    await user.clear(editor);
    await user.paste('input Changed {\n  x: Int\n}');

    const revertButton = screen.getByRole('button', { name: 'Revert changes' });
    await waitFor(() => expect(revertButton).toBeEnabled());
    await user.click(revertButton);

    expect(editor.value).toBe(initialValue);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(migrationBody).toBeNull();
  });
});
