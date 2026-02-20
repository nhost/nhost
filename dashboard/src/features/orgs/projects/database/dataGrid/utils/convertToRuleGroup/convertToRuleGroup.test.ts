import convertToRuleGroup from './convertToRuleGroup';

test('should return an empty rule group when there are no permissions or the object is invalid', () => {
  expect(convertToRuleGroup({})).toMatchObject({
    operator: '_and',
    rules: [],
    groups: [],
  });

  expect(convertToRuleGroup({ invalid: 'object' })).toMatchObject({
    operator: '_and',
    rules: [],
    groups: [],
  });

  expect(
    convertToRuleGroup({ key1: { _eq: 'test1' }, key2: { _eq: 'test2' } }),
  ).toMatchObject({
    operator: '_and',
    rules: [],
    groups: [],
  });
});

test('should convert value to stringified boolean if operator is _is_null', () => {
  expect(
    convertToRuleGroup({
      _or: [
        { title: { _eq: 'test' } },
        { title: { _is_null: true } },
        { title: { _is_null: 'true' } },
        { title: { _is_null: 'false' } },
      ],
    }),
  ).toMatchObject({
    operator: '_or',
    rules: [
      { column: 'title', operator: '_eq', value: 'test' },
      { column: 'title', operator: '_is_null', value: 'true' },
      { column: 'title', operator: '_is_null', value: 'true' },
      { column: 'title', operator: '_is_null', value: 'false' },
    ],
    groups: [],
  });
});

test('should convert a simple Hasura permission object to a rule group', () => {
  expect(convertToRuleGroup({ title: { _eq: 'test' } })).toMatchObject({
    operator: '_and',
    rules: [{ column: 'title', operator: '_eq', value: 'test' }],
    groups: [],
  });

  expect(convertToRuleGroup({ title: { _is_null: 'false' } })).toMatchObject({
    operator: '_and',
    rules: [{ column: 'title', operator: '_is_null', value: 'false' }],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      books: { author: { id: { _eq: 'X-Hasura-User-Id' } } },
    }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      {
        column: 'books.author.id',
        operator: '_eq',
        value: 'X-Hasura-User-Id',
      },
    ],
    groups: [],
  });
});

test('should convert a permission containing a relationship to a rule group', () => {
  expect(
    convertToRuleGroup({ author: { name: { _eq: 'John Doe' } } }),
  ).toMatchObject({
    operator: '_and',
    rules: [{ column: 'author.name', operator: '_eq', value: 'John Doe' }],
    groups: [],
  });
});

test('should convert a permission containing _and or _or on the top level to a rule group', () => {
  expect(
    convertToRuleGroup({
      _or: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
    }),
  ).toMatchObject({
    operator: '_or',
    rules: [
      { column: 'title', operator: '_eq', value: 'test' },
      { column: 'title', operator: '_eq', value: 'test2' },
    ],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      _and: [{ title: { _eq: 'test' } }, { title: { _eq: 'test2' } }],
    }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      { column: 'title', operator: '_eq', value: 'test' },
      { column: 'title', operator: '_eq', value: 'test2' },
    ],
    groups: [],
  });
});

test('should join a relationship when there is a nested group inside', () => {
  expect(
    convertToRuleGroup({
      author: {
        _and: [{ name: { _eq: 'John Doe' } }, { age: { _gte: '32' } }],
      },
    }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      { column: 'author.name', operator: '_eq', value: 'John Doe' },
      { column: 'author.age', operator: '_gte', value: '32' },
    ],
    groups: [],
  });
});

test('should convert a complex permission to a rule group', () => {
  expect(
    convertToRuleGroup({
      _or: [
        {
          author: {
            _and: [
              { name: { _eq: 'John Doe' } },
              { age: { _gte: '32' } },
              {
                _or: [{ name: { _eq: 'Mary Jane' } }, { age: { _lte: '48' } }],
              },
            ],
          },
        },
        { title: { _eq: 'test' } },
      ],
    }),
  ).toMatchObject({
    operator: '_or',
    rules: [{ column: 'title', operator: '_eq', value: 'test' }],
    groups: [
      {
        operator: '_and',
        rules: [
          { column: 'author.name', operator: '_eq', value: 'John Doe' },
          { column: 'author.age', operator: '_gte', value: '32' },
        ],
        groups: [
          {
            operator: '_or',
            rules: [
              { column: 'author.name', operator: '_eq', value: 'Mary Jane' },
              { column: 'author.age', operator: '_lte', value: '48' },
            ],
            groups: [],
          },
        ],
      },
    ],
  });
});

test('should convert JSONB operators to rules', () => {
  expect(
    convertToRuleGroup({ metadata: { _contains: { foo: 'bar' } } }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      { column: 'metadata', operator: '_contains', value: { foo: 'bar' } },
    ],
    groups: [],
  });

  expect(convertToRuleGroup({ metadata: { _has_key: 'foo' } })).toMatchObject({
    operator: '_and',
    rules: [{ column: 'metadata', operator: '_has_key', value: 'foo' }],
    groups: [],
  });
});

test('should handle _not operator correctly for non-invertible operators', () => {
  expect(
    convertToRuleGroup({ _not: { metadata: { _contains: { foo: 'bar' } } } }),
  ).toMatchObject({
    operator: '_not',
    rules: [
      { column: 'metadata', operator: '_contains', value: { foo: 'bar' } },
    ],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      _not: {
        json: {
          _has_key: 'hello',
        },
      },
    }),
  ).toMatchObject({
    operator: '_not',
    rules: [{ column: 'json', operator: '_has_key', value: 'hello' }],
    groups: [],
  });
});

test('should handle _not operator correctly without flattening', () => {
  expect(
    convertToRuleGroup({ _not: { title: { _eq: 'test' } } }),
  ).toMatchObject({
    operator: '_not',
    rules: [{ column: 'title', operator: '_eq', value: 'test' }],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      _not: {
        _or: [{ title: { _eq: 'test' } }, { age: { _gt: 32 } }],
      },
    }),
  ).toMatchObject({
    operator: '_not',
    rules: [],
    groups: [
      {
        operator: '_or',
        rules: [
          { column: 'title', operator: '_eq', value: 'test' },
          { column: 'age', operator: '_gt', value: 32 },
        ],
        groups: [],
      },
    ],
  });

  expect(
    convertToRuleGroup({
      _not: {
        _or: [
          { title: { _eq: 'test' } },
          { age: { _gt: 32 } },
          { _or: [{ title: { _eq: 'sample' } }, { age: { _lt: 24 } }] },
        ],
      },
    }),
  ).toMatchObject({
    operator: '_not',
    rules: [],
    groups: [
      {
        operator: '_or',
        rules: [
          { column: 'title', operator: '_eq', value: 'test' },
          { column: 'age', operator: '_gt', value: 32 },
        ],
        groups: [
          {
            operator: '_or',
            rules: [
              { column: 'title', operator: '_eq', value: 'sample' },
              { column: 'age', operator: '_lt', value: 24 },
            ],
            groups: [],
          },
        ],
      },
    ],
  });

  expect(
    convertToRuleGroup({
      _not: {
        title: { _is_null: true },
      },
    }),
  ).toMatchObject({
    operator: '_not',
    rules: [{ column: 'title', operator: '_is_null', value: 'true' }],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      _not: {
        title: { _is_null: 'false' },
      },
    }),
  ).toMatchObject({
    operator: '_not',
    rules: [{ column: 'title', operator: '_is_null', value: 'false' }],
    groups: [],
  });
});

test('should ignore unsupported _exists objects', () => {
  expect(
    convertToRuleGroup({
      _or: [
        { title: { _eq: 'test' } },
        {
          _exists: {
            _table: {
              name: 'users',
              schema: 'public',
            },
            _where: {
              id: {
                _eq: 'X-Hasura-User-Id',
              },
            },
          },
        },
        {
          books: {
            author: {
              _exists: {
                _table: {
                  name: 'users',
                  schema: 'public',
                },
                _where: {
                  id: {
                    _eq: 'X-Hasura-User-Id',
                  },
                },
              },
            },
          },
        },
        {
          _and: [
            { name: { _eq: 'John Doe' } },
            { age: { _gte: '32' } },
            {
              _exists: {
                _table: {
                  name: 'users',
                  schema: 'public',
                },
                _where: {
                  id: {
                    _eq: 'X-Hasura-User-Id',
                  },
                },
              },
            },
          ],
        },
      ],
    }),
  ).toMatchObject({
    operator: '_or',
    rules: [{ column: 'title', operator: '_eq', value: 'test' }],
    groups: [
      {
        operator: '_and',
        rules: [
          { column: 'name', operator: '_eq', value: 'John Doe' },
          { column: 'age', operator: '_gte', value: '32' },
        ],
        groups: [],
      },
    ],
  });

  expect(
    convertToRuleGroup({
      _and: [
        { name: { _eq: 'X-Hasura-User-Id' } },
        {
          _or: [
            { birth_date: { _eq: 'X-Hasura-User-Id' } },
            {
              _exists: {
                _table: { name: 'books', schema: 'public' },
                _where: { _and: [{ title: { _eq: 'X-Hasura-User-Id' } }] },
              },
            },
          ],
        },
      ],
    }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      { column: 'name', operator: '_eq', value: 'X-Hasura-User-Id' },
      { column: 'birth_date', operator: '_eq', value: 'X-Hasura-User-Id' },
    ],
    groups: [],
  });

  expect(
    convertToRuleGroup({
      books: {
        author: {
          _exists: {
            _table: {
              name: 'users',
              schema: 'public',
            },
            _where: {
              id: {
                _eq: 'X-Hasura-User-Id',
              },
            },
          },
        },
      },
    }),
  ).toMatchObject({
    operator: '_and',
    rules: [],
    groups: [],
  });
});
