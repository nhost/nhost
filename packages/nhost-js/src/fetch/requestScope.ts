/**
 * Origin scoping for credential-bearing middleware.
 *
 * Credentials are scoped to the service they were configured for, so a request
 * that has been retargeted (by custom middleware, or by a client pointed at
 * another host) cannot carry them off-origin.
 */

/**
 * The origin a credential middleware is allowed to write to.
 */
export interface RequestScope {
  /** True when `url` is the same origin (scheme, host and port) as the scope. */
  contains(url: string): boolean;

  /**
   * True when the admin secret may be sent: same origin, and either HTTPS, a
   * loopback host, or an explicit cleartext opt-in.
   */
  permitsAdminSession(url: string, allowInsecureHttp: boolean): boolean;

  /** The scope's path, with trailing slashes stripped (e.g. `/v1/auth`). */
  readonly pathPrefix: string;
}

/**
 * Parses a URL, returning null instead of throwing on invalid or relative input.
 */
const parse = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

const isLoopbackHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === 'localhost') {
    return true;
  }
  // URL normalises IPv6 hosts to bracketed form.
  const unbracketed =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (unbracketed === '::1' || unbracketed === '0:0:0:0:0:0:0:1') {
    return true;
  }
  // IPv4 loopback is the whole 127.0.0.0/8 block.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(unbracketed);
  if (!ipv4) {
    return false;
  }
  const octets = ipv4.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) && octets[0] === 127;
};

/**
 * Builds a scope from a service base URL.
 *
 * An unparseable base URL yields a scope that permits nothing, so every check
 * fails closed rather than silently disabling the origin restriction.
 *
 * @param baseUrl - The service base URL (e.g. `https://abc.auth.eu-central-1.nhost.run/v1`)
 * @returns A scope that answers origin and transport-security questions
 */
export const requestScopeFromBaseUrl = (baseUrl: string): RequestScope => {
  const base = parse(baseUrl);

  if (!base) {
    return {
      pathPrefix: '',
      contains: () => false,
      permitsAdminSession: () => false,
    };
  }

  const contains = (url: string): boolean => {
    const target = parse(url);
    // A relative URL has no origin of its own, so it cannot be shown to be in
    // scope. Fail closed rather than assuming it resolves against the service.
    return target !== null && target.origin === base.origin;
  };

  return {
    pathPrefix: base.pathname.replace(/\/+$/, ''),
    contains,
    permitsAdminSession: (url: string, allowInsecureHttp: boolean): boolean =>
      contains(url) &&
      (base.protocol === 'https:' ||
        allowInsecureHttp ||
        isLoopbackHost(base.hostname)),
  };
};
