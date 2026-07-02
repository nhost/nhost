import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createClient } from '@nhost/nhost-js';
import type { AgentEvent, AgentHistoryMessage } from '@nhost/nhost-js/ai';

const mockFetch = jest.fn();

global.fetch = mockFetch as unknown as typeof global.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(
  events: Array<{ event: string; data: unknown }>,
): Response {
  const body = events
    .map(
      ({ event, data }) =>
        `event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
    )
    .join('');
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// docstring:basic
test('basic', async () => {
  mockFetch
    // 1. insertAgentSession mutation
    .mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            insertGraphiteAgentSession: { id: 'session-123' },
          },
        }),
      ),
    )
    // 2. POST /messages SSE response
    .mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          { event: 'content_delta', data: { content: 'Hello ' } },
          { event: 'content_delta', data: { content: 'world!' } },
          {
            event: 'tool_call',
            data: { id: 'tc_1', name: 'search', arguments: '{"q":"nhost"}' },
          },
          {
            event: 'tool_result',
            data: { tool_call_id: 'tc_1', tool_name: 'search', content: 'ok' },
          },
          { event: 'done', data: '' },
        ]),
      ),
    );

  const subdomain = 'local';
  const region = 'local';

  const nhost = createClient({ subdomain, region });

  const session = await nhost.ai.newAgentSession({ agentID: 'agent-uuid' });

  const collected: AgentEvent[] = [];
  for await (const event of session.sendMessage('Hello agent')) {
    collected.push(event);

    if (event.type === 'content_delta') {
      // Stream a token to stdout, build up an in-progress reply, etc.
    } else if (event.type === 'tool_call') {
      // The agent is invoking a tool — `event.input` is the parsed arguments.
    } else if (event.type === 'tool_result') {
      // Result of the tool call — `event.content` is whatever the tool returned.
    }
  }

  expect(session.id).toBe('session-123');
  expect(collected.map((e) => e.type)).toEqual([
    'content_delta',
    'content_delta',
    'tool_call',
    'tool_result',
  ]);
});
// /docstring:basic

// docstring:approval
test('approval', async () => {
  mockFetch
    // 1. insertAgentSession
    .mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse({
          data: { insertGraphiteAgentSession: { id: 'session-abc' } },
        }),
      ),
    )
    // 2. POST /messages — server pauses on approval_required
    .mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          {
            event: 'tool_approval_required',
            data: {
              tool_calls: [
                { id: 'tc_1', name: 'web_search', arguments: '{"q":"x"}' },
              ],
            },
          },
        ]),
      ),
    )
    // 3. POST /approve-tools — stream resumes after approval
    .mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          {
            event: 'tool_result',
            data: {
              tool_call_id: 'tc_1',
              tool_name: 'web_search',
              content: 'result',
            },
          },
          { event: 'content_delta', data: { content: 'Done.' } },
          { event: 'done', data: '' },
        ]),
      ),
    );

  const nhost = createClient({ subdomain: 'local', region: 'local' });
  const session = await nhost.ai.newAgentSession({ agentID: 'agent-uuid' });

  const seen: string[] = [];
  for await (const event of session.sendMessage('Search for X')) {
    seen.push(event.type);

    if (event.type === 'approval_required') {
      // Inspect event.toolCalls and decide. Other options:
      //   - event.denyAll()
      //   - event.approve(['tc_1'])
      //   - event.deny(['tc_1'])
      //   - event.respond([{ toolCallID: 'tc_1', approved: true }])
      await event.approveAll();
    }
  }

  expect(seen).toEqual(['approval_required', 'tool_result', 'content_delta']);

  // The approval call carries the decisions in snake_case wire format.
  const approvalCall = mockFetch.mock.calls[2] as [string, RequestInit];
  expect(approvalCall[0]).toContain(
    '/agents/sessions/session-abc/approve-tools',
  );
  expect(JSON.parse(approvalCall[1].body as string)).toEqual({
    decisions: [{ tool_call_id: 'tc_1', approved: true }],
  });
});
// /docstring:approval

// docstring:resume
test('resume', async () => {
  mockFetch
    // 1. getAgentSession — returns the session with its past messages
    .mockImplementationOnce(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            graphiteAgentSession: {
              id: 'existing-session-id',
              agentID: 'agent-uuid',
              agentMessages: [
                {
                  id: 'm1',
                  role: 'user',
                  content: 'what are my tasks?',
                  toolCalls: null,
                  toolCallID: null,
                  toolName: null,
                  createdAt: '2026-04-23T11:52:13Z',
                },
                {
                  id: 'm2',
                  role: 'assistant',
                  content: 'Let me check.',
                  toolCalls: [
                    {
                      id: 'tc_1',
                      name: 'graphql_query',
                      arguments: '{"query":"{ todos { id } }"}',
                    },
                  ],
                  toolCallID: null,
                  toolName: null,
                  createdAt: '2026-04-23T11:52:13Z',
                },
                {
                  id: 'm3',
                  role: 'tool',
                  content: '{"data":{"todos":[]}}',
                  toolCalls: null,
                  toolCallID: 'tc_1',
                  toolName: 'graphql_query',
                  createdAt: '2026-04-23T11:52:14Z',
                },
              ],
            },
          },
        }),
      ),
    )
    // 2. POST /messages — continuing the conversation
    .mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          { event: 'content_delta', data: { content: 'Anything else?' } },
          { event: 'done', data: '' },
        ]),
      ),
    );

  const nhost = createClient({ subdomain: 'local', region: 'local' });

  const session = await nhost.ai.resumeSession({
    sessionID: 'existing-session-id',
  });

  // Inspect past messages — assistant text and tool calls are flattened into
  // separate entries so `history` can be iterated with the same switch as
  // live events.
  for (const msg of session.history) {
    if (msg.type === 'user') {
      // render the user bubble
    } else if (msg.type === 'assistant') {
      // render the assistant bubble
    } else if (msg.type === 'tool_call') {
      // render the tool invocation — msg.name, msg.input
    } else if (msg.type === 'tool_result') {
      // render the tool result — msg.toolName, msg.content
    }
  }

  // The session continues — sendMessage targets the same conversation.
  const stream = session.sendMessage('anything else?');
  for await (const _event of stream) {
    /* drain */
  }

  expect(session.id).toBe('existing-session-id');
  expect(session.agentID).toBe('agent-uuid');
  expect(session.history.map((m) => m.type)).toEqual([
    'user',
    'assistant',
    'tool_call',
    'tool_result',
  ]);
  const toolCall = session.history[2] as Extract<
    AgentHistoryMessage,
    { type: 'tool_call' }
  >;
  expect(toolCall.toolCallID).toBe('tc_1');
  expect(toolCall.input).toEqual({ query: '{ todos { id } }' });
});
// /docstring:resume

test('resume — empty session', async () => {
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      jsonResponse({
        data: {
          graphiteAgentSession: {
            id: 's',
            agentID: 'a',
            agentMessages: [],
          },
        },
      }),
    ),
  );

  const nhost = createClient({ subdomain: 'local', region: 'local' });
  const session = await nhost.ai.resumeSession({ sessionID: 's' });
  expect(session.history).toEqual([]);
});

test('resume — throws when session not found', async () => {
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      jsonResponse({
        data: { graphiteAgentSession: null },
      }),
    ),
  );

  const nhost = createClient({ subdomain: 'local', region: 'local' });
  await expect(
    nhost.ai.resumeSession({ sessionID: 'missing' }),
  ).rejects.toMatchObject({ status: 200 });
});

test('agentSession — history defaults to empty array', () => {
  const nhost = createClient({ subdomain: 'local', region: 'local' });
  const session = nhost.ai.agentSession('id-only');
  expect(session.history).toEqual([]);
});

describe('error handling', () => {
  test('throws FetchError on non-2xx', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(new Response('forbidden', { status: 403 })),
    );

    const nhost = createClient({ subdomain: 'local', region: 'local' });
    const session = nhost.ai.agentSession('s');

    const stream = session.sendMessage('hello');
    await expect(
      (async () => {
        for await (const _ of stream) {
          /* drain */
        }
      })(),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('approve(ids) approves only listed and denies the rest', async () => {
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve(
          jsonResponse({
            data: { insertGraphiteAgentSession: { id: 's2' } },
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          sseResponse([
            {
              event: 'tool_approval_required',
              data: {
                tool_calls: [
                  { id: 'a', name: 'x' },
                  { id: 'b', name: 'y' },
                ],
              },
            },
          ]),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(sseResponse([{ event: 'done', data: '' }])),
      );

    const nhost = createClient({ subdomain: 'local', region: 'local' });
    const session = await nhost.ai.newAgentSession({ agentID: 'a' });

    for await (const event of session.sendMessage('go')) {
      if (event.type === 'approval_required') {
        await event.approve(['a']);
      }
    }

    const approvalCall = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(approvalCall[1].body as string)).toEqual({
      decisions: [
        { tool_call_id: 'a', approved: true },
        { tool_call_id: 'b', approved: false },
      ],
    });
  });
});
