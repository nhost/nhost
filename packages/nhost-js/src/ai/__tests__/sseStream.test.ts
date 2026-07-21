import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createClient } from '@nhost/nhost-js';
import type { AgentEvent } from '@nhost/nhost-js/ai';

const mockFetch = jest.fn();

global.fetch = mockFetch as unknown as typeof global.fetch;

function rawSSEResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function collectEvents(stream: AsyncIterable<AgentEvent>) {
  const out: AgentEvent[] = [];
  for await (const event of stream) {
    out.push(event);
  }
  return out;
}

function makeSession() {
  const nhost = createClient({ subdomain: 'local', region: 'local' });
  return nhost.ai.agentSession('session-fixed', 'agent-fixed');
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('SSE parser', () => {
  test('joins multiple data: lines in a single event with \\n', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: content_delta',
            'data:  are your current tasks:',
            'data:',
            'data: | # | Title |',
            'data: |---|-------|',
            'data: | 1 | Buy milk |',
            '',
            'event: done',
            'data:',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'content_delta',
      content:
        ' are your current tasks:\n\n| # | Title |\n|---|-------|\n| 1 | Buy milk |',
    });
  });

  test('strips exactly one leading space from a field value', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          ['event: content_delta', 'data:   leading-spaces', '', ''].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      { type: 'content_delta', content: '  leading-spaces' },
    ]);
  });

  test('ignores comment lines starting with :', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            ': this is a heartbeat',
            'event: content_delta',
            ': another comment',
            'data: hello',
            '',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([{ type: 'content_delta', content: 'hello' }]);
  });

  test('handles CRLF line endings', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          'event: content_delta\r\ndata: line one\r\ndata: line two\r\n\r\n',
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      { type: 'content_delta', content: 'line one\nline two' },
    ]);
  });

  test('flushes a pending event at end of stream without trailing blank line', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse('event: content_delta\ndata: tail without blank line'),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      { type: 'content_delta', content: 'tail without blank line' },
    ]);
  });

  test('parses documented raw tool_use_start payload and keeps JSON forms', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: tool_use_start',
            'data: web_search',
            '',
            'event: tool_use_start',
            'data: "quoted_tool"',
            '',
            'event: tool_use_start',
            'data: {"id":"tc_1","name":"json_tool"}',
            '',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      { type: 'tool_use_start', name: 'web_search' },
      { type: 'tool_use_start', name: 'quoted_tool' },
      { type: 'tool_use_start', toolCallID: 'tc_1', name: 'json_tool' },
    ]);
  });

  test('parses JSON-shaped tool_call payload across multiple data: lines', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: tool_call',
            'data: {"id":"tc_1","name":"search",',
            'data: "arguments":"{\\"q\\":\\"nhost\\"}"}',
            '',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      {
        type: 'tool_call',
        toolCallID: 'tc_1',
        name: 'search',
        input: { q: 'nhost' },
      },
    ]);
  });

  test('event: field without a following data: dispatches nothing', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: content_delta',
            '',
            'event: content_delta',
            'data: real',
            '',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([{ type: 'content_delta', content: 'real' }]);
  });

  test('parses stop_reason event for max_tokens and refusal', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: content_delta',
            'data: partial',
            '',
            'event: stop_reason',
            'data: {"reason":"max_tokens"}',
            '',
            'event: done',
            'data:',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([
      { type: 'content_delta', content: 'partial' },
      { type: 'stop_reason', reason: 'max_tokens' },
    ]);
  });

  test('drops stop_reason events with unknown reason', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: stop_reason',
            'data: {"reason":"something_new"}',
            '',
            'event: done',
            'data:',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([]);
  });

  test('cancels and unlocks the response body when iteration stops early', async () => {
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
      Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    for await (const event of makeSession().sendMessage('hi')) {
      expect(event).toEqual({ type: 'content_delta', content: 'first' });
      break;
    }

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  test('skips done events and unknown event types', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        rawSSEResponse(
          [
            'event: content_delta',
            'data: hi',
            '',
            'event: mystery',
            'data: {"foo":"bar"}',
            '',
            'event: done',
            'data:',
            '',
          ].join('\n'),
        ),
      ),
    );

    const events = await collectEvents(makeSession().sendMessage('hi'));
    expect(events).toEqual([{ type: 'content_delta', content: 'hi' }]);
  });
});
