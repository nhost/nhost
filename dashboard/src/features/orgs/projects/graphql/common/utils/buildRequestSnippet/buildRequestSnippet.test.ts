import { buildCurlSnippet, buildFetchSnippet } from './buildRequestSnippet';

const input = {
  endpoint: 'https://local.graphql.local.nhost.run/v1',
  headers: { 'x-hasura-admin-secret': 's3cret', 'x-hasura-role': 'user' },
  query: '{ users(where: { displayName: { _eq: "Rui\'s" } }) { id } }',
  variables: { limit: 3 },
};

describe('buildCurlSnippet', () => {
  it('sends the endpoint, every header and the body', () => {
    const snippet = buildCurlSnippet(input);

    expect(snippet).toContain(
      "curl 'https://local.graphql.local.nhost.run/v1'",
    );
    expect(snippet).toContain("-H 'content-type: application/json'");
    expect(snippet).toContain(
      `-H 'x-hasura-admin-secret: '"$NHOST_ADMIN_SECRET"`,
    );
    expect(snippet).not.toContain('s3cret');
    expect(snippet).toContain("-H 'x-hasura-role: user'");
    expect(snippet).toContain('"variables":{"limit":3}');
  });

  it('escapes single quotes for the shell', () => {
    expect(buildCurlSnippet(input)).toContain(`Rui'\\''s`);
  });
});

describe('sensitive headers', () => {
  const withUserHeaders = {
    ...input,
    headers: {
      ...input.headers,
      authorization: 'Bearer abc.def',
      'x-api-key': 'k-123',
      'x-request-id': 'req-1',
    },
  };

  it('never copies their values, in either format', () => {
    for (const snippet of [
      buildCurlSnippet(withUserHeaders),
      buildFetchSnippet(withUserHeaders),
    ]) {
      expect(snippet).not.toContain('abc.def');
      expect(snippet).not.toContain('k-123');
      expect(snippet).toContain('req-1');
    }
  });

  it('reads them from environment variables', () => {
    expect(buildCurlSnippet(withUserHeaders)).toContain(
      `-H 'authorization: '"$AUTHORIZATION"`,
    );
    expect(buildFetchSnippet(withUserHeaders)).toContain(
      '"x-api-key": process.env.X_API_KEY,',
    );
  });
});

describe('header names a shell could run', () => {
  it('keeps them in single quotes', () => {
    const snippet = buildCurlSnippet({
      ...input,
      headers: { 'x-`whoami`-token': 'abc' },
    });

    expect(snippet).toContain(`-H 'x-\`whoami\`-token: '"$X_WHOAMI_TOKEN"`);
    expect(snippet).not.toContain('abc');
  });
});

describe('buildFetchSnippet', () => {
  it('posts the query, variables and headers to the endpoint', () => {
    const snippet = buildFetchSnippet(input);

    expect(snippet).toContain(
      'await fetch("https://local.graphql.local.nhost.run/v1", {',
    );
    expect(snippet).toContain("method: 'POST'");
    expect(snippet).toContain('"x-hasura-role": "user"');
    expect(snippet).toContain('"limit": 3');
    expect(snippet).toContain(
      '"x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET,',
    );
    expect(snippet).not.toContain('s3cret');
  });
});
