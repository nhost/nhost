import type { TransportResponse } from '@graphiql/toolkit';

export type ResponseTone = 'busy' | 'success' | 'error';

/** What the response status pill shows, with the details after it. */
export interface ResponseDescription {
  tone: ResponseTone;
  label: string;
  meta?: string;
}

interface DescribeResponseOptions {
  /** A request is running. */
  isFetching: boolean;
  /** A subscription is open. */
  isLive: boolean;
  /** GraphiQL's last response, if it belongs to the open tab. */
  response: TransportResponse | null;
}

/** GraphiQL's last response, with the tab, run and text it was shown with. */
export interface OwnedResponse {
  response: TransportResponse;
  tabId: string | undefined;
  queryId: number;
  responseText: string | null | undefined;
}

interface OpenTabState {
  tabId: string | undefined;
  queryId: number;
  responseText: string | null | undefined;
}

/**
 * Whether the open tab still shows the owned response. Stopping a run (another
 * tab, user or role) keeps its text, so the response still counts. A run
 * GraphiQL refused to send (invalid Variables or Headers) writes its error in
 * place of the text without a new response, so it no longer does.
 */
export function isOwnedResponseShown(
  owned: OwnedResponse | null,
  openTab: OpenTabState,
) {
  if (!owned || owned.tabId !== openTab.tabId || !openTab.responseText) {
    return false;
  }

  return (
    owned.queryId === openTab.queryId ||
    owned.responseText === openTab.responseText
  );
}

export function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} ${sizeBytes === 1 ? 'byte' : 'bytes'}`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countErrors(body: TransportResponse['body']) {
  const results = Array.isArray(body) ? body : [body];

  return results.reduce(
    (count, result) =>
      count + (Array.isArray(result?.errors) ? result.errors.length : 0),
    0,
  );
}

/**
 * The response status pill for GraphiQL's last response: Running, Live,
 * Success, GraphQL error or Failed. Null before the first run.
 */
export default function describeResponse({
  isFetching,
  isLive,
  response,
}: DescribeResponseOptions): ResponseDescription | null {
  if (isLive) {
    return { tone: 'busy', label: 'Live' };
  }

  if (isFetching) {
    return { tone: 'busy', label: 'Running…' };
  }

  if (!response) {
    return null;
  }

  const duration = formatDuration(response.timing.totalMs);

  // An HTTP error, or a request that never got a response (no status).
  if (
    (response.status !== undefined && response.status >= 400) ||
    (response.status === undefined && !response.ok)
  ) {
    return {
      tone: 'error',
      label: response.status ? `Failed (${response.status})` : 'Failed',
      meta: duration,
    };
  }

  const errorCount = countErrors(response.body);

  if (errorCount > 0) {
    return {
      tone: 'error',
      label: 'GraphQL error',
      meta: `${errorCount} ${errorCount === 1 ? 'error' : 'errors'} · ${duration}`,
    };
  }

  return {
    tone: 'success',
    label: 'Success',
    meta: [
      duration,
      response.size.response !== undefined
        ? formatSize(response.size.response)
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}
