import type { TransportResponse } from '@graphiql/toolkit';
import {
  describeResponse,
  formatDuration,
  formatSize,
  isOwnedResponseShown,
} from '@/features/orgs/projects/graphql/common/utils/describeResponse';

function response(overrides: Partial<TransportResponse>): TransportResponse {
  return {
    ok: true,
    status: 200,
    body: { data: {} },
    timing: { totalMs: 364 },
    size: { response: 345 },
    ...overrides,
  };
}

const idle = { isFetching: false, isLive: false };

describe('describeResponse', () => {
  it('shows nothing before the first run', () => {
    expect(describeResponse({ ...idle, response: null })).toBeNull();
  });

  it('shows a running request, and an open subscription as live', () => {
    expect(
      describeResponse({ ...idle, isFetching: true, response: null }),
    ).toEqual({ tone: 'busy', label: 'Running…' });
    expect(
      describeResponse({
        isFetching: true,
        isLive: true,
        response: response({}),
      }),
    ).toEqual({ tone: 'busy', label: 'Live' });
  });

  it('shows the time and size of a successful response', () => {
    expect(describeResponse({ ...idle, response: response({}) })).toEqual({
      tone: 'success',
      label: 'Success',
      meta: '364 ms · 345 bytes',
    });
  });

  it('counts GraphQL errors', () => {
    expect(
      describeResponse({
        ...idle,
        response: response({
          ok: false,
          body: { errors: [{ message: 'a' }, { message: 'b' }] } as never,
        }),
      }),
    ).toEqual({
      tone: 'error',
      label: 'GraphQL error',
      meta: '2 errors · 364 ms',
    });
  });

  it('shows the HTTP status of a failed request', () => {
    expect(
      describeResponse({
        ...idle,
        response: response({ ok: false, status: 502 }),
      }),
    ).toEqual({ tone: 'error', label: 'Failed (502)', meta: '364 ms' });
  });

  it('shows a request that never got a response as failed', () => {
    expect(
      describeResponse({
        ...idle,
        response: response({
          ok: false,
          status: undefined,
          body: { errors: [{ message: 'Failed to fetch' }] } as never,
        }),
      }),
    ).toEqual({ tone: 'error', label: 'Failed', meta: '364 ms' });
  });
});

describe('isOwnedResponseShown', () => {
  const owned = {
    response: response({}),
    tabId: 'tab-1',
    queryId: 3,
    responseText: '{"data":{}}',
  };

  it('shows the response on the tab that ran it', () => {
    expect(
      isOwnedResponseShown(owned, {
        tabId: 'tab-1',
        queryId: 3,
        responseText: '{"data":{}}',
      }),
    ).toBe(true);
    expect(
      isOwnedResponseShown(owned, {
        tabId: 'tab-2',
        queryId: 3,
        responseText: '{"data":{}}',
      }),
    ).toBe(false);
  });

  it('keeps it after a stop that leaves the text, like a tab switch', () => {
    expect(
      isOwnedResponseShown(owned, {
        tabId: 'tab-1',
        queryId: 5,
        responseText: '{"data":{}}',
      }),
    ).toBe(true);
  });

  it('drops it when a run is refused and its error replaces the text', () => {
    expect(
      isOwnedResponseShown(owned, {
        tabId: 'tab-1',
        queryId: 4,
        responseText: '{"errors":[{"message":"Request not sent."}]}',
      }),
    ).toBe(false);
  });

  it('drops it when the tab no longer shows a response', () => {
    expect(
      isOwnedResponseShown(owned, {
        tabId: 'tab-1',
        queryId: 3,
        responseText: '',
      }),
    ).toBe(false);
    expect(
      isOwnedResponseShown(null, {
        tabId: 'tab-1',
        queryId: 3,
        responseText: '{"data":{}}',
      }),
    ).toBe(false);
  });
});

describe('formatDuration and formatSize', () => {
  it('formats short and long values', () => {
    expect(formatDuration(452.6)).toBe('453 ms');
    expect(formatDuration(1234)).toBe('1.23 s');
    expect(formatSize(512)).toBe('512 bytes');
    expect(formatSize(1)).toBe('1 byte');
    expect(formatSize(1229)).toBe('1.2 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
