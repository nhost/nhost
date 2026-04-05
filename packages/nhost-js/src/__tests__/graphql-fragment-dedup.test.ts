import { describe, expect, it } from '@jest/globals';
import type { DocumentNode } from 'graphql';
import {
  deduplicateFragments,
  extractQueryFromDocument,
} from '@nhost/nhost-js/graphql';

/**
 * Helper to create a mock TypedDocumentNode with the given source body and definitions.
 * Each definition has loc offsets pointing into the source body.
 */
function createMockDocument(
  sourceBody: string,
  definitions: Array<{
    kind: string;
    name?: { value: string };
    start: number;
    end: number;
  }>,
): DocumentNode {
  return {
    kind: 'Document',
    definitions: definitions.map((def) => ({
      kind: def.kind,
      ...(def.name ? { name: { kind: 'Name', value: def.name.value } } : {}),
      loc: {
        start: def.start,
        end: def.end,
        source: { body: sourceBody } as never,
        startToken: {} as never,
        endToken: {} as never,
        toJSON: () => ({}),
      },
    })) as DocumentNode['definitions'],
    loc: {
      start: 0,
      end: sourceBody.length,
      source: {
        body: sourceBody,
        name: 'GraphQL',
        locationOffset: { line: 1, column: 1 },
      },
      startToken: {} as never,
      endToken: {} as never,
      toJSON: () => ({}),
    },
  };
}

describe('extractQueryFromDocument', () => {
  describe('basic functionality', () => {
    it('extracts a simple query without fragments', () => {
      const source = 'query GetUser { user { id name } }';
      const doc = createMockDocument(source, [
        {
          kind: 'OperationDefinition',
          name: { value: 'GetUser' },
          start: 0,
          end: source.length,
        },
      ]);

      expect(extractQueryFromDocument(doc)).toBe(source);
    });

    it('extracts a query with a single fragment', () => {
      const queryPart = 'query GetUser { user { ...UserFields } }';
      const fragmentPart =
        'fragment UserFields on User { id name email }';
      const source = `${queryPart}\n${fragmentPart}`;
      const doc = createMockDocument(source, [
        {
          kind: 'OperationDefinition',
          name: { value: 'GetUser' },
          start: 0,
          end: queryPart.length,
        },
        {
          kind: 'FragmentDefinition',
          name: { value: 'UserFields' },
          start: queryPart.length + 1,
          end: source.length,
        },
      ]);

      const result = extractQueryFromDocument(doc);
      expect(result).toContain(queryPart);
      expect(result).toContain(fragmentPart);
    });
  });

  describe('fragment deduplication', () => {
    it('deduplicates when source has duplicate fragments but AST does not', () => {
      // Simulates what graphql-tag produces: the source body has duplicates
      // but the definitions array is already deduplicated.
      const queryPart =
        'query GetUser { user { ...ClientAvatar ...EmployeeAvatar } }';
      const clientFragment =
        'fragment ClientAvatar on Client { avatar { ...Picture } }';
      const pictureFragment1 = 'fragment Picture on Image { url width height }';
      const employeeFragment =
        'fragment EmployeeAvatar on Employee { avatar { ...Picture } }';
      const pictureFragment2 = 'fragment Picture on Image { url width height }';

      // Raw source with duplicate Picture fragment (as produced by template literal concatenation)
      const source = [
        queryPart,
        clientFragment,
        pictureFragment1,
        employeeFragment,
        pictureFragment2,
      ].join('\n');

      // The AST definitions are deduplicated (graphql-tag removes the duplicate)
      let offset = 0;
      const queryStart = offset;
      offset += queryPart.length + 1;
      const clientStart = offset;
      offset += clientFragment.length + 1;
      const picture1Start = offset;
      offset += pictureFragment1.length + 1;
      const employeeStart = offset;
      // Skip pictureFragment2 in the AST (it's the duplicate)

      const doc = createMockDocument(source, [
        {
          kind: 'OperationDefinition',
          name: { value: 'GetUser' },
          start: queryStart,
          end: queryStart + queryPart.length,
        },
        {
          kind: 'FragmentDefinition',
          name: { value: 'ClientAvatar' },
          start: clientStart,
          end: clientStart + clientFragment.length,
        },
        {
          kind: 'FragmentDefinition',
          name: { value: 'Picture' },
          start: picture1Start,
          end: picture1Start + pictureFragment1.length,
        },
        {
          kind: 'FragmentDefinition',
          name: { value: 'EmployeeAvatar' },
          start: employeeStart,
          end: employeeStart + employeeFragment.length,
        },
      ]);

      const result = extractQueryFromDocument(doc);

      // Should contain each fragment exactly once
      expect(result.match(/fragment Picture/g)).toHaveLength(1);
      expect(result.match(/fragment ClientAvatar/g)).toHaveLength(1);
      expect(result.match(/fragment EmployeeAvatar/g)).toHaveLength(1);
      expect(result).toContain(queryPart);
    });

    it('deduplicates with three levels of nested fragments', () => {
      // Query -> FragA -> FragB -> FragC, Query -> FragD -> FragB -> FragC
      // Raw source has FragB and FragC duplicated
      const queryPart = 'query Deep { root { ...FragA ...FragD } }';
      const fragA = 'fragment FragA on A { field { ...FragB } }';
      const fragB1 = 'fragment FragB on B { field { ...FragC } }';
      const fragC1 = 'fragment FragC on C { value }';
      const fragD = 'fragment FragD on D { field { ...FragB } }';
      const fragB2 = 'fragment FragB on B { field { ...FragC } }';
      const fragC2 = 'fragment FragC on C { value }';

      const source = [queryPart, fragA, fragB1, fragC1, fragD, fragB2, fragC2].join('\n');

      // AST has deduplicated definitions
      let offset = 0;
      const parts = [queryPart, fragA, fragB1, fragC1, fragD];
      const offsets: number[] = [];
      for (const part of parts) {
        offsets.push(offset);
        offset += part.length + 1;
      }

      const doc = createMockDocument(source, [
        { kind: 'OperationDefinition', name: { value: 'Deep' }, start: offsets[0], end: offsets[0] + queryPart.length },
        { kind: 'FragmentDefinition', name: { value: 'FragA' }, start: offsets[1], end: offsets[1] + fragA.length },
        { kind: 'FragmentDefinition', name: { value: 'FragB' }, start: offsets[2], end: offsets[2] + fragB1.length },
        { kind: 'FragmentDefinition', name: { value: 'FragC' }, start: offsets[3], end: offsets[3] + fragC1.length },
        { kind: 'FragmentDefinition', name: { value: 'FragD' }, start: offsets[4], end: offsets[4] + fragD.length },
      ]);

      const result = extractQueryFromDocument(doc);
      expect(result.match(/fragment FragB/g)).toHaveLength(1);
      expect(result.match(/fragment FragC/g)).toHaveLength(1);
      expect(result.match(/fragment FragA/g)).toHaveLength(1);
      expect(result.match(/fragment FragD/g)).toHaveLength(1);
      expect(result).toContain('query Deep');
    });

    it('matches the exact issue scenario: three fragments referencing the same Picture fragment', () => {
      const queryPart = 'query GetAuthenticatedUser { me { ...ClientAvatarInfo ...EmployeeAvatarInfo ...FacilityAvatarInfo } }';
      const clientFrag = 'fragment ClientAvatarInfo on Client { name avatar { ...Picture } }';
      const pictureFrag1 = 'fragment Picture on Image { url thumbnailUrl }';
      const employeeFrag = 'fragment EmployeeAvatarInfo on Employee { name avatar { ...Picture } }';
      const pictureFrag2 = 'fragment Picture on Image { url thumbnailUrl }';
      const facilityFrag = 'fragment FacilityAvatarInfo on Facility { name avatar { ...Picture } }';
      const pictureFrag3 = 'fragment Picture on Image { url thumbnailUrl }';

      const source = [queryPart, clientFrag, pictureFrag1, employeeFrag, pictureFrag2, facilityFrag, pictureFrag3].join('\n');

      // AST is deduplicated: only one Picture fragment
      let offset = 0;
      const uniqueParts = [queryPart, clientFrag, pictureFrag1, employeeFrag, facilityFrag];
      const offsets: number[] = [];
      for (const part of uniqueParts) {
        offsets.push(offset);
        // Find the actual offset in the source
        offset = source.indexOf(part) + part.length + 1;
      }

      const doc = createMockDocument(source, [
        { kind: 'OperationDefinition', name: { value: 'GetAuthenticatedUser' }, start: source.indexOf(queryPart), end: source.indexOf(queryPart) + queryPart.length },
        { kind: 'FragmentDefinition', name: { value: 'ClientAvatarInfo' }, start: source.indexOf(clientFrag), end: source.indexOf(clientFrag) + clientFrag.length },
        { kind: 'FragmentDefinition', name: { value: 'Picture' }, start: source.indexOf(pictureFrag1), end: source.indexOf(pictureFrag1) + pictureFrag1.length },
        { kind: 'FragmentDefinition', name: { value: 'EmployeeAvatarInfo' }, start: source.indexOf(employeeFrag), end: source.indexOf(employeeFrag) + employeeFrag.length },
        { kind: 'FragmentDefinition', name: { value: 'FacilityAvatarInfo' }, start: source.indexOf(facilityFrag), end: source.indexOf(facilityFrag) + facilityFrag.length },
      ]);

      const result = extractQueryFromDocument(doc);

      // The critical assertion: Picture should appear exactly once
      expect(result.match(/fragment Picture/g)).toHaveLength(1);
      expect(result).toContain('fragment ClientAvatarInfo');
      expect(result).toContain('fragment EmployeeAvatarInfo');
      expect(result).toContain('fragment FacilityAvatarInfo');
      expect(result).toContain('query GetAuthenticatedUser');
    });
  });

  describe('edge cases', () => {
    it('returns empty string when document has no loc', () => {
      const doc = {
        kind: 'Document',
        definitions: [],
      } as unknown as DocumentNode;

      expect(extractQueryFromDocument(doc)).toBe('');
    });

    it('returns raw source when definitions lack loc', () => {
      const source = 'query Simple { field }';
      const doc = {
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            name: { kind: 'Name', value: 'Simple' },
            // No loc on definition
          },
        ],
        loc: {
          start: 0,
          end: source.length,
          source: {
            body: source,
            name: 'GraphQL',
            locationOffset: { line: 1, column: 1 },
          },
          startToken: {} as never,
          endToken: {} as never,
          toJSON: () => ({}),
        },
      } as unknown as DocumentNode;

      expect(extractQueryFromDocument(doc)).toBe(source);
    });

    it('handles a query with no fragments', () => {
      const source = 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }';
      const doc = createMockDocument(source, [
        {
          kind: 'OperationDefinition',
          name: { value: 'CreateUser' },
          start: 0,
          end: source.length,
        },
      ]);

      expect(extractQueryFromDocument(doc)).toBe(source);
    });

    it('handles a document with only fragment definitions (no operation)', () => {
      const frag1 = 'fragment A on Type { id }';
      const frag2 = 'fragment B on Type { name }';
      const source = `${frag1}\n${frag2}`;
      const doc = createMockDocument(source, [
        { kind: 'FragmentDefinition', name: { value: 'A' }, start: 0, end: frag1.length },
        { kind: 'FragmentDefinition', name: { value: 'B' }, start: frag1.length + 1, end: source.length },
      ]);

      const result = extractQueryFromDocument(doc);
      expect(result).toContain(frag1);
      expect(result).toContain(frag2);
    });

    it('preserves whitespace and formatting within definitions', () => {
      const query = `query GetUser {
  user {
    id
    name
  }
}`;
      const fragment = `fragment UserFields on User {
  id
  name
  email
}`;
      const source = `${query}\n${fragment}`;
      const doc = createMockDocument(source, [
        { kind: 'OperationDefinition', name: { value: 'GetUser' }, start: 0, end: query.length },
        { kind: 'FragmentDefinition', name: { value: 'UserFields' }, start: query.length + 1, end: source.length },
      ]);

      const result = extractQueryFromDocument(doc);
      expect(result).toContain(query);
      expect(result).toContain(fragment);
    });
  });

  describe('integration with graphql-tag', () => {
    let gql: typeof import('graphql-tag').default;

    beforeAll(async () => {
      gql = (await import('graphql-tag')).default;
    });

    it('handles a simple gql document', () => {
      const doc = gql`
        query GetUser {
          user {
            id
            name
          }
        }
      `;

      const result = extractQueryFromDocument(doc);
      expect(result).toContain('query GetUser');
      expect(result).toContain('user');
      expect(result).toContain('id');
      expect(result).toContain('name');
    });

    it('handles gql document with a fragment', () => {
      const FIELDS = gql`
        fragment UserFields on User {
          id
          name
        }
      `;

      const doc = gql`
        query GetUser {
          user {
            ...UserFields
          }
        }
        ${FIELDS}
      `;

      const result = extractQueryFromDocument(doc);
      expect(result).toContain('query GetUser');
      expect(result).toContain('fragment UserFields');
      expect(result.match(/fragment UserFields/g)).toHaveLength(1);
    });

    it('deduplicates fragments composed through multiple paths via gql tag', () => {
      const PICTURE = gql`
        fragment Picture on Image {
          url
          width
          height
        }
      `;

      const CLIENT_AVATAR = gql`
        fragment ClientAvatar on Client {
          avatar {
            ...Picture
          }
        }
        ${PICTURE}
      `;

      const EMPLOYEE_AVATAR = gql`
        fragment EmployeeAvatar on Employee {
          avatar {
            ...Picture
          }
        }
        ${PICTURE}
      `;

      const doc = gql`
        query GetUser {
          me {
            client {
              ...ClientAvatar
            }
            employee {
              ...EmployeeAvatar
            }
          }
        }
        ${CLIENT_AVATAR}
        ${EMPLOYEE_AVATAR}
      `;

      const result = extractQueryFromDocument(doc);

      // This is the core fix: Picture must appear only once
      expect(result.match(/fragment Picture/g)).toHaveLength(1);
      expect(result.match(/fragment ClientAvatar/g)).toHaveLength(1);
      expect(result.match(/fragment EmployeeAvatar/g)).toHaveLength(1);
      expect(result).toContain('query GetUser');

      // Verify the old approach would have failed
      const rawSource = doc.loc?.source.body || '';
      expect(rawSource.match(/fragment Picture/g)?.length).toBeGreaterThan(1);
    });

    it('produces valid GraphQL when deduplicating (no empty gaps)', () => {
      const PICTURE = gql`
        fragment Picture on Image {
          url
        }
      `;

      const A = gql`
        fragment A on X {
          pic {
            ...Picture
          }
        }
        ${PICTURE}
      `;

      const B = gql`
        fragment B on Y {
          pic {
            ...Picture
          }
        }
        ${PICTURE}
      `;

      const doc = gql`
        query Q {
          a {
            ...A
          }
          b {
            ...B
          }
        }
        ${A}
        ${B}
      `;

      const result = extractQueryFromDocument(doc);
      // No triple+ newlines (gaps where duplicates were removed)
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('deduplicates with three levels of nesting via gql tag', () => {
      const BASE = gql`
        fragment BaseFields on Base {
          id
          createdAt
        }
      `;

      const MIDDLE_A = gql`
        fragment MiddleA on TypeA {
          fieldA {
            ...BaseFields
          }
        }
        ${BASE}
      `;

      const MIDDLE_B = gql`
        fragment MiddleB on TypeB {
          fieldB {
            ...BaseFields
          }
        }
        ${BASE}
      `;

      const MIDDLE_C = gql`
        fragment MiddleC on TypeC {
          fieldC {
            ...BaseFields
          }
        }
        ${BASE}
      `;

      const doc = gql`
        query GetAll {
          a { ...MiddleA }
          b { ...MiddleB }
          c { ...MiddleC }
        }
        ${MIDDLE_A}
        ${MIDDLE_B}
        ${MIDDLE_C}
      `;

      const result = extractQueryFromDocument(doc);

      expect(result.match(/fragment BaseFields/g)).toHaveLength(1);
      expect(result.match(/fragment MiddleA/g)).toHaveLength(1);
      expect(result.match(/fragment MiddleB/g)).toHaveLength(1);
      expect(result.match(/fragment MiddleC/g)).toHaveLength(1);

      // Confirm raw source has duplicates
      const rawSource = doc.loc?.source.body || '';
      expect(rawSource.match(/fragment BaseFields/g)?.length).toBeGreaterThan(1);
    });
  });
});

describe('deduplicateFragments', () => {
  it('removes duplicate fragments from a raw string', () => {
    const source = [
      'query Q { user { ...A ...B } }',
      'fragment A on User { name { ...Pic } }',
      'fragment Pic on Image { url }',
      'fragment B on User { avatar { ...Pic } }',
      'fragment Pic on Image { url }',
    ].join('\n');

    const result = deduplicateFragments(source);
    expect(result.match(/fragment Pic/g)).toHaveLength(1);
    expect(result).toContain('fragment A');
    expect(result).toContain('fragment B');
    expect(result).toContain('query Q');
  });

  it('handles fragments with nested braces (2 levels)', () => {
    const source = [
      'query Q { f { ...Frag } }',
      'fragment Frag on T { a { b { c } } }',
      'fragment Frag on T { a { b { c } } }',
    ].join('\n');

    const result = deduplicateFragments(source);
    expect(result.match(/fragment Frag/g)).toHaveLength(1);
  });

  it('returns the same string when there are no duplicates', () => {
    const source =
      'query Q { f }\nfragment A on T { id }\nfragment B on T { name }';
    const result = deduplicateFragments(source);
    expect(result).toContain('fragment A');
    expect(result).toContain('fragment B');
    expect(result).toContain('query Q');
  });

  it('returns the same string when there are no fragments', () => {
    const source = 'query Q { user { id name } }';
    expect(deduplicateFragments(source)).toBe(source);
  });

  it('handles multiple different duplicates', () => {
    const source = [
      'query Q { f }',
      'fragment A on T { id }',
      'fragment B on T { name }',
      'fragment A on T { id }',
      'fragment B on T { name }',
      'fragment A on T { id }',
    ].join('\n');

    const result = deduplicateFragments(source);
    expect(result.match(/fragment A/g)).toHaveLength(1);
    expect(result.match(/fragment B/g)).toHaveLength(1);
  });

  it('cleans up extra whitespace from removed fragments', () => {
    const source =
      'query Q { f }\n\nfragment A on T { id }\n\nfragment A on T { id }\n\nfragment B on T { name }';
    const result = deduplicateFragments(source);
    expect(result).not.toMatch(/\n{3,}/);
  });
});
