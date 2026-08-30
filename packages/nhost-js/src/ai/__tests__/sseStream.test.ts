import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createClient, withAdminSession } from '../../index';
import type { AgentEvent, ApprovalRequiredEvent } from '../index';

const mockFetch = jest.fn<typeof globalThis.fetch>();
globalThis.fetch = mockFetch;

function rawSSEResponse(body: BodyInit | null): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function requestOptions(callIndex: number): RequestInit {
  const call = mockFetch.mock.calls[callIndex] as [string, RequestInit];
  return call[1];
}

function parseRequestBody(callIndex: number): unknown {
  const body = requestOptions(callIndex).body;
  if (typeof body !== 'string') {
    throw new Error(`Request ${callIndex} does not have a string body`);
  }

  try {
    return JSON.parse(body);
  } catch (error: unknown) {
    throw new Error(`Request ${callIndex} body is not JSON`, { cause: error });
  }
}

function approvalResponse(
  toolCalls: Array<{
    id: string;
    name: string;
    arguments?: string;
    requires_approval: boolean;
  }>,
): Response {
  return rawSSEResponse(
    `event: tool_approval_required\ndata: ${JSON.stringify({ tool_calls: toolCalls })}\n\n`,
  );
}

async function collectEvents(
  stream: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

function makeSession() {
  return createClient({ subdomain: 'local', region: 'local' }).ai.agentSession(
    'session-fixed',
    'agent-fixed',
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('AI service SSE protocol', () => {
  test('joins multiline data and accepts LF, CRLF, and bare CR framing', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: content_delta\n',
            'data: line one\n',
            'data: line two\n\n',
            'event: content_delta\r\n',
            'data: crlf\r\n\r\n',
            'event: content_delta\r',
            'data: bare-cr\r\r',
          ].join(''),
        ),
      ),
    );

    await expect(
      collectEvents(makeSession().sendMessage('hi')),
    ).resolves.toEqual([
      { type: 'content_delta', content: 'line one\nline two' },
      { type: 'content_delta', content: 'crlf' },
      { type: 'content_delta', content: 'bare-cr' },
    ]);
  });

  test('decodes UTF-8 and framing split across arbitrary response chunks', async () => {
    const encoded = new TextEncoder().encode(
      'event: content_delta\r\ndata: hello 🙂\r\n\r\n',
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < encoded.length; index += 1) {
          controller.enqueue(encoded.slice(index, index + 1));
        }
        controller.close();
      },
    });
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(rawSSEResponse(body)),
    );

    await expect(
      collectEvents(makeSession().sendMessage('hi')),
    ).resolves.toEqual([{ type: 'content_delta', content: 'hello 🙂' }]);
  });

  test('preserves content chunks that happen to be valid JSON', async () => {
    const chunks = ['true', 'null', '123', '"quoted"', '{"key":"value"}'];
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          chunks
            .map((data) => `event: content_delta\ndata: ${data}\n\n`)
            .join(''),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual(
      chunks.map((content) => ({ type: 'content_delta', content })),
    );
  });

  test('maps every current service event payload', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: tool_use_start\ndata: web_search\n\n',
            'event: tool_call\ndata: {"id":"tc-1","name":"web_search","arguments":"{\\"q\\":\\"nhost\\"}"}\n\n',
            'event: tool_result\ndata: {"role":"tool","content":"found","tool_call_id":"tc-1","tool_name":"web_search"}\n\n',
            'event: tool_denied\ndata: {"role":"tool","content":"Tool call denied by user","tool_call_id":"tc-2","tool_name":"web_fetch"}\n\n',
            'event: stop_reason\ndata: {"reason":"max_tokens"}\n\n',
            'event: error\ndata: internal error\n\n',
            'event: done\ndata: \n\n',
          ].join(''),
        ),
      ),
    );

    await expect(
      collectEvents(makeSession().sendMessage('hi')),
    ).resolves.toEqual([
      { type: 'tool_use_start', name: 'web_search' },
      {
        type: 'tool_call',
        toolCallID: 'tc-1',
        name: 'web_search',
        input: { q: 'nhost' },
      },
      {
        type: 'tool_result',
        toolCallID: 'tc-1',
        toolName: 'web_search',
        content: 'found',
      },
      {
        type: 'tool_denied',
        toolCallID: 'tc-2',
        toolName: 'web_fetch',
        content: 'Tool call denied by user',
      },
      { type: 'stop_reason', reason: 'max_tokens' },
      { type: 'error', error: 'internal error' },
    ]);
  });

  test('preserves approval metadata and continues on the same iterator', async () => {
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve(
          approvalResponse([
            {
              id: 'tc-1',
              name: 'web_search',
              arguments: '{"q":"nhost"}',
              requires_approval: true,
            },
            {
              id: 'tc-2',
              name: 'web_fetch',
              arguments: '{"url":"https://nhost.io"}',
              requires_approval: false,
            },
          ]),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          rawSSEResponse(
            'event: content_delta\ndata: continued\n\nevent: done\ndata: \n\n',
          ),
        ),
      );

    const headers = new Headers({ Authorization: 'Bearer token' });
    const events: AgentEvent[] = [];
    for await (const event of makeSession().sendMessage('hi', { headers })) {
      events.push(event);
      if (event.type === 'approval_required') {
        expect(event.toolCalls).toEqual([
          {
            id: 'tc-1',
            name: 'web_search',
            input: { q: 'nhost' },
            requiresApproval: true,
          },
          {
            id: 'tc-2',
            name: 'web_fetch',
            input: { url: 'https://nhost.io' },
            requiresApproval: false,
          },
        ]);
        await event.approve(['tc-1']);
      }
    }

    expect(events.map(({ type }) => type)).toEqual([
      'approval_required',
      'content_delta',
    ]);
    expect(parseRequestBody(1)).toEqual({
      decisions: [
        { tool_call_id: 'tc-1', approved: true },
        { tool_call_id: 'tc-2', approved: false },
      ],
    });
    for (let index = 0; index < mockFetch.mock.calls.length; index += 1) {
      expect(
        new Headers(requestOptions(index).headers).get('Authorization'),
      ).toBe('Bearer token');
    }
  });

  test.each([
    {
      name: 'plain object',
      headers: { Authorization: 'Bearer object' } as HeadersInit,
      expected: 'Bearer object',
    },
    {
      name: 'Headers instance',
      headers: new Headers({ Authorization: 'Bearer headers' }),
      expected: 'Bearer headers',
    },
    {
      name: 'tuple array',
      headers: [['Authorization', 'Bearer tuples']] as HeadersInit,
      expected: 'Bearer tuples',
    },
  ])('preserves $name request headers', async ({ headers, expected }) => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(rawSSEResponse('event: done\ndata: \n\n')),
    );

    await collectEvents(makeSession().sendMessage('hi', { headers }));

    const sentHeaders = new Headers(requestOptions(0).headers);
    expect(sentHeaders.get('Authorization')).toBe(expected);
    expect(sentHeaders.get('Content-Type')).toBe('application/json');
  });

  test('applies admin middleware to AI requests', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(rawSSEResponse('event: done\ndata: \n\n')),
    );
    const adminSecret = crypto.randomUUID();
    const session = createClient({
      configure: [
        withAdminSession({
          adminSecret,
          role: 'user',
          sessionVariables: {
            'user-id': '2e0e9147-c1f0-4d7e-bb18-f2eb4b9c9810',
          },
        }),
      ],
    }).ai.agentSession('admin-session');

    await collectEvents(session.sendMessage('hi'));

    const sentHeaders = new Headers(requestOptions(0).headers);
    expect(sentHeaders.get('x-hasura-admin-secret')).toBe(adminSecret);
    expect(sentHeaders.get('x-hasura-role')).toBe('user');
    expect(sentHeaders.get('x-hasura-user-id')).toBe(
      '2e0e9147-c1f0-4d7e-bb18-f2eb4b9c9810',
    );
  });

  test('uses a custom AI service URL', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(rawSSEResponse('event: done\ndata: \n\n')),
    );
    const session = createClient({
      aiUrl: 'https://ai.example.com/v1',
    }).ai.agentSession('custom-session');

    await collectEvents(session.sendMessage('hi'));

    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      'https://ai.example.com/v1/agents/sessions/custom-session/messages',
    );
  });

  test('throws FetchError for a pre-stream JSON response', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'session is busy' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      collectEvents(makeSession().sendMessage('hi')),
    ).rejects.toMatchObject({
      status: 409,
      body: { error: 'session is busy' },
      message: 'session is busy',
    });
  });

  test('rejects an approval HTTP error immediately and allows retry', async () => {
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve(
          approvalResponse([
            {
              id: 'tc-1',
              name: 'web_search',
              requires_approval: true,
            },
          ]),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'session is busy' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(rawSSEResponse('event: done\ndata: \n\n')),
      );

    const iterator = makeSession().sendMessage('hi')[Symbol.asyncIterator]();
    const first = await iterator.next();
    const approval = first.value as ApprovalRequiredEvent;

    await expect(approval.approveAll()).rejects.toMatchObject({
      status: 409,
      message: 'session is busy',
    });
    await approval.approveAll();
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('cancels an approval continuation when iteration closes', async () => {
    const cancel = jest.fn<() => void>();
    const continuationBody = new ReadableStream<Uint8Array>({ cancel });
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve(
          approvalResponse([
            {
              id: 'tc-1',
              name: 'web_search',
              requires_approval: true,
            },
          ]),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(rawSSEResponse(continuationBody)),
      );

    const iterator = makeSession().sendMessage('hi')[Symbol.asyncIterator]();
    const first = await iterator.next();
    await (first.value as ApprovalRequiredEvent).approveAll();
    await iterator.return?.();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(continuationBody.locked).toBe(false);
  });

  test('rejects unknown or duplicate selected tool call IDs', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        approvalResponse([
          { id: 'tc-1', name: 'one', requires_approval: true },
          { id: 'tc-2', name: 'two', requires_approval: true },
        ]),
      ),
    );

    const iterator = makeSession().sendMessage('hi')[Symbol.asyncIterator]();
    const first = await iterator.next();
    const approval = first.value as ApprovalRequiredEvent;

    await expect(approval.approve(['missing'])).rejects.toThrow(
      'must be unique and belong to the approval request',
    );
    await expect(approval.deny(['missing'])).rejects.toThrow(
      'must be unique and belong to the approval request',
    );
    await expect(approval.approve(['tc-1', 'tc-1'])).rejects.toThrow(
      'must be unique and belong to the approval request',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await iterator.return?.();
  });

  test('requires one decision per pending call and accepts decisions once', async () => {
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve(
          approvalResponse([
            { id: 'tc-1', name: 'one', requires_approval: true },
            { id: 'tc-2', name: 'two', requires_approval: true },
          ]),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(rawSSEResponse('event: done\ndata: \n\n')),
      );

    const iterator = makeSession().sendMessage('hi')[Symbol.asyncIterator]();
    const first = await iterator.next();
    const approval = first.value as ApprovalRequiredEvent;

    await expect(
      approval.respond([{ toolCallID: 'tc-1', approved: true }]),
    ).rejects.toThrow('every pending tool call exactly once');
    await approval.approveAll();
    await expect(approval.denyAll()).rejects.toThrow('already been submitted');
    await iterator.return?.();
  });

  test('cancels and unlocks a response when iteration stops early', async () => {
    const cancel = jest.fn<() => void>();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: content_delta\ndata: first\n\n'),
        );
      },
      cancel,
    });
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(rawSSEResponse(body)),
    );

    for await (const event of makeSession().sendMessage('hi')) {
      expect(event).toEqual({ type: 'content_delta', content: 'first' });
      break;
    }

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  test('forwards the caller AbortSignal', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(
      (_url: Parameters<typeof fetch>[0], options?: RequestInit) => {
        expect(options?.signal?.aborted).toBe(false);
        controller.abort('cancelled');
        expect(options?.signal?.aborted).toBe(true);
        return Promise.reject(options?.signal?.reason);
      },
    );

    await expect(
      collectEvents(
        makeSession().sendMessage('hi', { signal: controller.signal }),
      ),
    ).rejects.toBe('cancelled');
  });
});
