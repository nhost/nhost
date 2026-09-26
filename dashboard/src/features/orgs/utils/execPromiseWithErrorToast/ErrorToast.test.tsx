import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import createEventTrigger from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation/createEventTrigger';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type {
  CreateEventTriggerArgs,
  ExportMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';
import ErrorToast from './ErrorToast';
import execPromiseWithErrorToast from './execPromiseWithErrorToast';

const HASURA = 'https://local.hasura.local.nhost.run';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (70) did not match current version';

const project = {
  id: 'project-id',
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};
const otherProject = { ...project, id: 'other-id', subdomain: 'other-app' };
const metadataKey = [EXPORT_METADATA_QUERY_KEY, project.subdomain];
const otherMetadataKey = [EXPORT_METADATA_QUERY_KEY, otherProject.subdomain];
const oldMetadata: ExportMetadataResponse = {
  resource_version: 70,
  metadata: { version: 3, sources: [] },
};
const freshMetadata: ExportMetadataResponse = {
  resource_version: 71,
  metadata: {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        tables: [{ table: { schema: 'public', name: 'table' } }],
      },
    ],
  },
};
const exportOperation = { type: 'export_metadata', version: 2, args: {} };

const mocks = vi.hoisted(() => ({ useProject: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const requests: unknown[] = [];
const exportResponse = vi.fn<() => Promise<Response>>();
const server = setupServer(
  http.post(`${HASURA}/v1/metadata`, async ({ request }) => {
    const body = (await request.json()) as { type: string };
    requests.push(body);
    if (body.type === 'export_metadata') {
      return exportResponse();
    }
    if (body.type === 'bulk') {
      return HttpResponse.json(
        { error: CONFLICT_MESSAGE, path: '$', code: 'conflict' },
        { status: 409 },
      );
    }
    return HttpResponse.json(
      { error: 'Unexpected operation' },
      { status: 400 },
    );
  }),
);

function conflictToast() {
  return (
    <ErrorToast
      toastId="metadata-conflict"
      errorMessage="Could not save changes"
      error={new Error(CONFLICT_MESSAGE)}
    />
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient.clear();
  queryClient.setQueryDefaults([EXPORT_METADATA_QUERY_KEY], {
    cacheTime: Number.POSITIVE_INFINITY,
  });
  mocks.useProject.mockReturnValue({ project, loading: false });
  requests.length = 0;
  exportResponse
    .mockReset()
    .mockResolvedValue(HttpResponse.json(freshMetadata));
});
afterEach(() => {
  toast.remove();
  queryClient.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

test('should render the provided error message', () => {
  const errorMessage =
    'An error occurred while updating the service. Please try again.';
  render(
    <ErrorToast
      toastId="update-service-error"
      errorMessage={errorMessage}
      error={
        new Error('strconv.ParseInt: parsing "302300": value out of range')
      }
    />,
  );

  expect(screen.getByText(errorMessage)).toBeInTheDocument();
});

test('should render the fallback text when the message is empty', () => {
  render(
    <ErrorToast toastId="empty-error" errorMessage="" error={new Error()} />,
  );

  expect(
    screen.getByText('An unknown error has occurred, please try again later!'),
  ).toBeInTheDocument();
});

test.each([70, 1])(
  'offers manual recovery for resource version %s without fetching on render',
  async (version) => {
    render(
      <ErrorToast
        toastId="metadata-conflict"
        errorMessage="A customized display message"
        error={
          new Error(
            `metadata resource version referenced (${version}) did not match current version`,
          )
        }
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Fetch metadata' }),
      ).toBeEnabled();
    });
    expect(
      screen.getByRole('heading', { name: 'Metadata is out of date' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'To save your changes, fetch the latest metadata, review your changes, then try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Unsaved form changes may be reset'),
    ).toBeInTheDocument();
    expect(queryClient.isFetching()).toBe(0);
    expect(requests).toEqual([]);
  },
);

test('explains the metadata conflict through the accessible info tooltip', async () => {
  const user = new TestUserEvent();
  render(conflictToast());

  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.keyboard('{Tab}{Tab}');
  expect(
    screen.getByRole('button', { name: 'About metadata versions' }),
  ).toHaveFocus();
  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'The metadata on the server is newer than the metadata currently loaded in the dashboard.',
    );
  });
  expect(requests).toEqual([]);
});

test.each([
  'conflict',
  '409 Conflict',
  'metadata export failed',
  'metadata resource version referenced (abc) did not match current version',
  `prefix ${CONFLICT_MESSAGE}`,
  `${CONFLICT_MESSAGE} suffix`,
])('does not offer recovery for unrelated error: %s', async (message) => {
  render(
    <ErrorToast
      toastId="unrelated"
      errorMessage={message}
      error={new Error(message)}
    />,
  );

  await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Fetch metadata' })).toBeNull();
  expect(queryClient.isFetching()).toBe(0);
  expect(requests).toEqual([]);
});

test('does not recognize a conflict solely from the display message', () => {
  render(
    <ErrorToast
      toastId="unrelated"
      errorMessage={CONFLICT_MESSAGE}
      error={new Error('Unrelated error')}
    />,
  );

  expect(screen.getByText(CONFLICT_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Fetch metadata' })).toBeNull();
});

test('does not show button loading or dismiss the toast for a background metadata fetch', async () => {
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  queryClient.setQueryData(metadataKey, oldMetadata);
  const pending = Promise.withResolvers<Response>();
  exportResponse.mockReturnValue(pending.promise);
  render(conflictToast());

  const backgroundFetch = queryClient.fetchQuery({
    queryKey: metadataKey,
    staleTime: 0,
    queryFn: () =>
      fetchExportMetadata({
        appUrl: HASURA,
        adminSecret: project.config.hasura.adminSecret,
      }),
  });
  await waitFor(() => expect(requests).toEqual([exportOperation]));
  expect(queryClient.isFetching({ queryKey: metadataKey })).toBe(1);
  expect(screen.getByRole('button', { name: 'Fetch metadata' })).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Fetching metadata…' }),
  ).not.toBeInTheDocument();

  pending.resolve(HttpResponse.json(freshMetadata));
  await backgroundFetch;
  expect(queryClient.getQueryData(metadataKey)).toEqual(freshMetadata);
  expect(dismissSpy).not.toHaveBeenCalled();
});

test('refreshes the complete cache and dismisses only after the fetch succeeds', async () => {
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  queryClient.setQueryData(metadataKey, oldMetadata);
  queryClient.setQueryData(otherMetadataKey, oldMetadata);
  const pending = Promise.withResolvers<Response>();
  exportResponse.mockReturnValue(pending.promise);
  const user = new TestUserEvent();
  render(conflictToast());

  await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));
  await waitFor(() => expect(requests).toEqual([exportOperation]));
  const button = screen.getByRole('button', { name: 'Fetching metadata…' });
  expect(button).toBeDisabled();
  await user.keyboard('{Enter}{Enter}');
  expect(requests).toHaveLength(1);
  expect(queryClient.getQueryData(metadataKey)).toEqual(oldMetadata);
  expect(dismissSpy).not.toHaveBeenCalled();

  pending.resolve(HttpResponse.json(freshMetadata));
  await waitFor(() =>
    expect(dismissSpy).toHaveBeenCalledWith('metadata-conflict'),
  );
  expect(dismissSpy).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole('heading', { name: 'Metadata fetched' }),
  ).not.toBeInTheDocument();
  expect(queryClient.getQueryData(metadataKey)).toEqual(freshMetadata);
  expect(queryClient.getQueryData(otherMetadataKey)).toEqual(oldMetadata);
  expect(requests).toEqual([exportOperation]);
});

test('handles the real event-trigger 409 error path without replaying the mutation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  queryClient.setQueryData(metadataKey, oldMetadata);
  const args: CreateEventTriggerArgs = {
    name: 'somting',
    source: 'default',
    table: { name: 'table', schema: 'public' },
    webhook: 'http://httpbin.org/delay/1',
    webhook_from_env: null,
    insert: { columns: '*' },
    update: null,
    delete: null,
    headers: [],
    retry_conf: { num_retries: 0, interval_sec: 10, timeout_sec: 60 },
    enable_manual: false,
    replace: false,
  };
  const user = new TestUserEvent();
  render(<div />);

  await execPromiseWithErrorToast(
    () =>
      createEventTrigger({
        appUrl: HASURA,
        adminSecret: project.config.hasura.adminSecret,
        args,
        resourceVersion: 70,
      }),
    {
      loadingMessage: 'Creating event trigger...',
      successMessage: 'Event trigger created.',
      errorMessage: 'Could not create event trigger.',
    },
  );

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeEnabled();
  });
  const mutation = {
    type: 'bulk',
    source: 'default',
    resource_version: 70,
    args: [{ type: 'pg_create_event_trigger', args }],
  };
  expect(requests).toEqual([mutation]);
  await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));
  await waitFor(
    () =>
      expect(
        screen.queryByRole('heading', { name: 'Metadata is out of date' }),
      ).not.toBeInTheDocument(),
    { timeout: 2000 },
  );
  expect(queryClient.getQueryData(metadataKey)).toEqual(freshMetadata);
  expect(requests).toEqual([mutation, exportOperation]);
  expect(screen.queryByText('Event trigger created.')).not.toBeInTheDocument();
});

test('updates the same toast on failure and dismisses it after a successful retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  queryClient.setQueryData(metadataKey, oldMetadata);
  exportResponse.mockResolvedValueOnce(
    HttpResponse.json({ error: 'Export failed' }, { status: 500 }),
  );
  const user = new TestUserEvent();
  render(<div />);
  toast(() => conflictToast(), {
    id: 'metadata-conflict',
    duration: Number.POSITIVE_INFINITY,
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeEnabled(),
  );

  const fetchButton = screen.getByRole('button', { name: 'Fetch metadata' });
  await user.click(fetchButton);
  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: 'Couldn’t fetch metadata' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try again. If the problem persists, reload the page.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
  expect(screen.getByRole('button', { name: 'Try again' })).toBe(fetchButton);
  expect(
    screen.queryByRole('heading', { name: 'Metadata is out of date' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'About metadata versions' }),
  ).not.toBeInTheDocument();
  expect(dismissSpy).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(metadataKey)).toEqual(oldMetadata);
  await user.click(screen.getByRole('button', { name: 'Show error details' }));
  expect(
    screen.getByText(/"message": "metadata resource version referenced/),
  ).toHaveTextContent(CONFLICT_MESSAGE);

  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(dismissSpy).toHaveBeenCalledWith('metadata-conflict'),
  );
  expect(dismissSpy).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(metadataKey)).toEqual(freshMetadata);
  expect(requests).toEqual([exportOperation, exportOperation]);
});

test('cannot retarget a persistent toast to another project', async () => {
  const user = new TestUserEvent();
  const { rerender } = render(conflictToast());
  mocks.useProject.mockReturnValue({ project: otherProject, loading: false });
  rerender(conflictToast());

  const button = screen.getByRole('button', { name: 'Fetch metadata' });
  expect(button).toBeDisabled();
  expect(
    screen.getByText(/Fetching metadata is unavailable here/),
  ).toBeInTheDocument();
  await user.keyboard('{Tab}{Tab}{Tab}{Enter}');
  expect(queryClient.isFetching()).toBe(0);
  expect(requests).toEqual([]);
});

test('dismisses only the original toast after navigation during a refresh', async () => {
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  queryClient.setQueryData(metadataKey, oldMetadata);
  queryClient.setQueryData(otherMetadataKey, oldMetadata);
  const pending = Promise.withResolvers<Response>();
  exportResponse.mockReturnValue(pending.promise);
  const user = new TestUserEvent();
  const { rerender } = render(conflictToast());

  await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));
  await waitFor(() => expect(requests).toEqual([exportOperation]));
  mocks.useProject.mockReturnValue({ project: otherProject, loading: false });
  rerender(conflictToast());
  pending.resolve(HttpResponse.json(freshMetadata));

  await waitFor(() => {
    expect(queryClient.getQueryData(metadataKey)).toEqual(freshMetadata);
    expect(dismissSpy).toHaveBeenCalledWith('metadata-conflict');
    expect(
      screen.getByRole('button', { name: 'Fetching metadata…' }),
    ).toBeDisabled();
  });
  expect(
    screen.getByText(/Fetching metadata is unavailable here/),
  ).toBeInTheDocument();
  expect(dismissSpy).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(otherMetadataKey)).toEqual(oldMetadata);
  expect(requests).toEqual([exportOperation]);
});

test('keeps the original project target when a fetch fails after navigation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  queryClient.setQueryData(metadataKey, oldMetadata);
  queryClient.setQueryData(otherMetadataKey, oldMetadata);
  const pending = Promise.withResolvers<Response>();
  exportResponse.mockReturnValue(pending.promise);
  const user = new TestUserEvent();
  const { rerender } = render(<div />);
  toast(() => conflictToast(), {
    id: 'metadata-conflict',
    duration: Number.POSITIVE_INFINITY,
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeEnabled(),
  );

  await user.click(screen.getByRole('button', { name: 'Fetch metadata' }));
  await waitFor(() => expect(requests).toEqual([exportOperation]));
  mocks.useProject.mockReturnValue({ project: otherProject, loading: false });
  rerender(<div />);
  pending.resolve(
    HttpResponse.json({ error: 'Export failed' }, { status: 500 }),
  );

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeDisabled();
  });
  expect(dismissSpy).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(metadataKey)).toEqual(oldMetadata);
  expect(queryClient.getQueryData(otherMetadataKey)).toEqual(oldMetadata);
  expect(requests).toEqual([exportOperation]);
});

test.each([
  { project: null, loading: false },
  { project: { ...project, config: undefined }, loading: false },
  { project: { ...project, id: undefined }, loading: false },
  { project: { ...project, subdomain: undefined }, loading: false },
  { project: { ...project, region: undefined }, loading: false },
  { project, loading: true },
])(
  'does not fetch without a ready project and API target: %j',
  async (context) => {
    mocks.useProject.mockReturnValue(context);
    const user = new TestUserEvent();
    render(conflictToast());

    expect(
      screen.getByRole('button', { name: 'Fetch metadata' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Fetching metadata is unavailable here/),
    ).toBeInTheDocument();
    await user.keyboard('{Tab}{Tab}{Tab}{Enter}');
    expect(queryClient.isFetching()).toBe(0);
    expect(requests).toEqual([]);
  },
);

test('does not adopt a project if none was available when the toast mounted', () => {
  mocks.useProject.mockReturnValue({ project: null, loading: true });
  const { rerender } = render(conflictToast());
  mocks.useProject.mockReturnValue({ project, loading: false });
  rerender(conflictToast());

  expect(screen.getByRole('button', { name: 'Fetch metadata' })).toBeDisabled();
  expect(queryClient.isFetching()).toBe(0);
  expect(requests).toEqual([]);
});

test('expands error details above the metadata action footer', async () => {
  const user = new TestUserEvent();
  render(conflictToast());

  await user.click(screen.getByRole('button', { name: 'Show error details' }));
  const details = screen.getByText(
    /"message": "metadata resource version referenced/,
  );
  const fetchButton = screen.getByRole('button', { name: 'Fetch metadata' });
  expect(
    details.compareDocumentPosition(fetchButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(fetchButton).toBeEnabled();

  await user.click(screen.getByRole('button', { name: 'Show error details' }));
  expect(details).not.toBeInTheDocument();
  expect(fetchButton).toBeVisible();
  expect(requests).toEqual([]);
});

test('preserves original details, copy, and manual dismissal', async () => {
  const user = new TestUserEvent();
  const copySpy = vi.spyOn(navigator.clipboard, 'writeText');
  const dismissSpy = vi.spyOn(toast, 'dismiss');
  render(conflictToast());

  await user.click(screen.getByRole('button', { name: 'Show error details' }));
  expect(
    screen.getByText(/"message": "metadata resource version referenced/),
  ).toHaveTextContent(CONFLICT_MESSAGE);
  await user.click(screen.getByRole('button', { name: 'Copy error details' }));
  expect(copySpy).toHaveBeenCalledOnce();
  const copied = copySpy.mock.calls[0][0];
  expect(JSON.parse(copied)).toMatchObject({
    info: { projectId: project.id },
    error: { name: 'Error', message: CONFLICT_MESSAGE },
  });
  expect(copied).not.toContain(project.config.hasura.adminSecret);
  await user.click(screen.getByRole('button', { name: 'Show error details' }));
  expect(
    screen.queryByRole('button', { name: 'Copy error details' }),
  ).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(dismissSpy).toHaveBeenCalledWith('metadata-conflict');
});
