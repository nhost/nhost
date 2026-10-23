export interface RequestSnippetInput {
  /**
   * GraphQL endpoint the playground sends requests to.
   */
  endpoint: string;
  /**
   * Headers the playground sends with the request.
   */
  headers: Record<string, string>;
  /**
   * The query as written in the editor.
   */
  query: string;
  /**
   * Parsed variables from the Variables tab.
   */
  variables: Record<string, unknown>;
}

// The admin secret is never written into a snippet: snippets get pasted into
// chats, shell history and code. They read it from an environment variable.
export const ADMIN_SECRET_HEADER = 'x-hasura-admin-secret';
export const ADMIN_SECRET_ENV = 'NHOST_ADMIN_SECRET';

// Headers from the Headers tab can hold secrets too (a bearer token, an API
// key). Any header whose name looks sensitive is replaced the same way.
const SENSITIVE_HEADER_NAME =
  /secret|token|key|auth|password|passwd|cookie|session|credential|signature/i;

/**
 * Name of the environment variable a snippet reads a header's value from, or
 * null when the value is safe to copy as is.
 */
export function getHeaderEnvName(name: string) {
  if (name.toLowerCase() === ADMIN_SECRET_HEADER) {
    return ADMIN_SECRET_ENV;
  }

  if (!SENSITIVE_HEADER_NAME.test(name)) {
    return null;
  }

  const envName = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  // Variable names can't start with a digit.
  return /^[0-9]/.test(envName) ? `HEADER_${envName}` : envName;
}

function getBody({ query, variables }: RequestSnippetInput) {
  return JSON.stringify({ query, variables });
}

function getHeaders({ headers }: RequestSnippetInput) {
  return { 'content-type': 'application/json', ...headers };
}

// Wraps a value in single quotes for a POSIX shell.
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The request as a cURL command, ready to run in a terminal.
 */
export function buildCurlSnippet(input: RequestSnippetInput) {
  const headerLines = Object.entries(getHeaders(input)).map(([name, value]) => {
    const envName = getHeaderEnvName(name);

    // The name stays in single quotes (a header name may contain ` or $,
    // which a shell would run inside double quotes); only the variable is
    // left outside them so it expands.
    return envName
      ? `  -H ${shellQuote(`${name}: `)}"$${envName}"`
      : `  -H ${shellQuote(`${name}: ${value}`)}`;
  });

  return [
    `curl ${shellQuote(input.endpoint)}`,
    ...headerLines,
    `  --data-raw ${shellQuote(getBody(input))}`,
  ].join(' \\\n');
}

/**
 * The request as a JavaScript fetch call, ready to paste into code.
 */
export function buildFetchSnippet(input: RequestSnippetInput) {
  const headerLines = Object.entries(getHeaders(input)).map(([name, value]) => {
    const envName = getHeaderEnvName(name);

    return envName
      ? `    ${JSON.stringify(name)}: process.env.${envName},`
      : `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`;
  });
  const headers = ['{', ...headerLines, '  }'].join('\n');
  const body = JSON.stringify(
    { query: input.query, variables: input.variables },
    null,
    2,
  ).replace(/\n/g, '\n  ');

  return [
    `const response = await fetch(${JSON.stringify(input.endpoint)}, {`,
    `  method: 'POST',`,
    `  headers: ${headers},`,
    `  body: JSON.stringify(${body}),`,
    '});',
    '',
    'const { data, errors } = await response.json();',
  ].join('\n');
}
