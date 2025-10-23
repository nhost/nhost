/**
 * Headers middleware for the Nhost SDK.
 *
 * This module provides middleware functionality to automatically attach
 * default headers to all outgoing requests, while allowing request-specific
 * headers to take precedence.
 */

import type { ChainFunction, FetchFunction } from "./fetch";

/**
 * Creates a fetch middleware that attaches default headers to requests.
 *
 * This middleware:
 * 1. Merges default headers with request-specific headers
 * 2. Preserves request-specific headers when they conflict with defaults
 *
 * The middleware ensures consistent headers across requests while allowing
 * individual requests to override defaults as needed.
 *
 * @param defaultHeaders - Default headers to attach to all requests
 * @returns A middleware function that can be used in the fetch chain
 */
export const withHeadersMiddleware =
  (defaultHeaders: HeadersInit): ChainFunction =>
  (next: FetchFunction): FetchFunction =>
  async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    const defaults = new Headers(defaultHeaders);

    defaults.forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });

    return next(url, { ...options, headers });
  };
