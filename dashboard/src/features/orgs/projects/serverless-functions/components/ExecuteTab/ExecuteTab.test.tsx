import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { FormData as UndiciFormData } from 'undici';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import ExecuteTab from './ExecuteTab';

Object.assign(global, { FormData: UndiciFormData });

const FUNCTION_URL = 'http://test.example/my-fn';

interface CapturedRequest {
  contentType: string | null;
  body?: string;
  formData?: FormData;
}

let captured: CapturedRequest;

const handler = http.post(FUNCTION_URL, async ({ request }) => {
  const contentType = request.headers.get('content-type');
  const next: CapturedRequest = { contentType };

  if (contentType?.includes('multipart/form-data')) {
    next.formData = await request.formData();
  } else {
    next.body = await request.text();
  }

  captured = next;
  return HttpResponse.json({ ok: true });
});

const server = setupServer(handler);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  mockPointerEvent();
  captured = { contentType: null };
});

async function switchMethodToPost(user: TestUserEvent) {
  const [methodSelect] = screen.getAllByRole('combobox');
  await user.click(methodSelect);
  await user.click(screen.getByRole('option', { name: 'POST' }));
}

async function pickContentType(user: TestUserEvent, contentType: string) {
  const comboboxes = screen.getAllByRole('combobox');
  // method select is first; ContentTypeCombobox is the last visible trigger
  await user.click(comboboxes[comboboxes.length - 1]);
  await user.click(screen.getByRole('option', { name: contentType }));
}

function clickSend() {
  // user.click + mockPointerEvent does not trigger implicit form submit;
  // fireEvent.click works because it skips the pointer sequence.
  const [sendButton] = screen.getAllByRole('button', { name: 'Send' });
  fireEvent.click(sendButton);
}

describe('ExecuteTab', () => {
  it('sends application/x-www-form-urlencoded body with matching Content-Type', async () => {
    render(<ExecuteTab endpointUrl={FUNCTION_URL} />);
    const user = new TestUserEvent();

    await switchMethodToPost(user);
    await user.click(screen.getByRole('tab', { name: 'Request' }));
    await pickContentType(user, 'application/x-www-form-urlencoded');

    await user.type(screen.getByPlaceholderText('Field name'), 'name');
    await user.type(screen.getByPlaceholderText('Field value'), 'Alice');
    await user.click(screen.getByRole('button', { name: /add row/i }));

    const keyInputs = screen.getAllByPlaceholderText('Field name');
    const valueInputs = screen.getAllByPlaceholderText('Field value');
    await user.type(keyInputs[1], 'role');
    await user.type(valueInputs[1], 'admin');

    clickSend();

    await waitFor(() => {
      expect(captured.body).toBe('name=Alice&role=admin');
    });
    expect(captured.contentType).toBe('application/x-www-form-urlencoded');
  });

  it('sends multipart body and lets fetch set Content-Type with boundary', async () => {
    render(<ExecuteTab endpointUrl={FUNCTION_URL} />);
    const user = new TestUserEvent();

    await switchMethodToPost(user);
    await user.click(screen.getByRole('tab', { name: 'Request' }));
    await pickContentType(user, 'multipart/form-data');

    await user.type(screen.getByPlaceholderText('Parameter name'), 'upload');

    const fileInput = screen.getByLabelText('File upload') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    clickSend();

    await waitFor(() => {
      expect(captured.contentType).toMatch(
        /^multipart\/form-data; boundary=.+/,
      );
    });
    const uploaded = captured.formData?.get('upload');
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe('hello.txt');
  });

  it('strips a user-supplied Content-Type header when sending multipart', async () => {
    render(<ExecuteTab endpointUrl={FUNCTION_URL} />);
    const user = new TestUserEvent();

    await switchMethodToPost(user);

    await user.click(screen.getByRole('button', { name: /add row/i }));
    await user.type(screen.getByPlaceholderText('Header name'), 'Content-Type');
    await user.type(
      screen.getByPlaceholderText('Header value'),
      'application/json',
    );

    await user.click(screen.getByRole('tab', { name: 'Request' }));
    await pickContentType(user, 'multipart/form-data');

    await user.type(screen.getByPlaceholderText('Parameter name'), 'field');
    await user.type(screen.getByPlaceholderText('Value'), 'val');

    clickSend();

    await waitFor(() => {
      expect(captured.contentType).toMatch(
        /^multipart\/form-data; boundary=.+/,
      );
    });
    expect(captured.contentType).not.toBe('application/json');
  });
});
