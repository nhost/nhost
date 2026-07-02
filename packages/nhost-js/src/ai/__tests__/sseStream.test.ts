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
