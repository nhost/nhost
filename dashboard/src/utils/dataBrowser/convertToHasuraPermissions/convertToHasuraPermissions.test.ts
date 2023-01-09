import convertToHasuraPermissions from './convertToHasuraPermissions';

test('should return null if there are no rules or groups', () => {
  expect(convertToHasuraPermissions()).toBeNull();
  expect(convertToHasuraPermissions(null)).toBeNull();
  expect(convertToHasuraPermissions(undefined)).toBeNull();
});

test('should return an empty object if the input is an empty object', () => {
  expect(convertToHasuraPermissions({})).toMatchObject({});
});

test(`should return an empty object if the input doesn't have any rules or groups`, () => {
  expect(
    convertToHasuraPermissions({ operator: '_and', rules: [], groups: [] }),
  ).toMatchObject({});
});

test(`should remove a nesting level if it only contains a single group and no rules`, () => {
  expect(
    convertToHasuraPermissions({
      operator: '_and',
      rules: [],
      groups: [
        {
          operator: '_and',
          rules: [{ column: 'id', operator: '_eq', value: 'X-Hasura-User-Id' }],
          groups: [],
        },
      ],
    }),
  ).toMatchObject({ id: { _eq: 'X-Hasura-User-Id' } });
});

test('should not return any operators if there is only one rule in a group', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_and',
      rules: [{ column: 'title', operator: '_eq', value: 'test' }],
      groups: [],
    }),
  ).toMatchObject({
    title: {
      _eq: 'test',
    },
  });
});

test('should break down a column path into a nested object', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_and',
      rules: [
        {
          column: 'author.id',
          operator: '_eq',
          value: '2aeba074-df72-4bd5-b827-162620a3438a',
        },
      ],
      groups: [],
    }),
  ).toMatchObject({
    author: {
      id: {
        _eq: '2aeba074-df72-4bd5-b827-162620a3438a',
      },
    },
  });

  expect(
    convertToHasuraPermissions({
      operator: '_and',
      rules: [
        {
          column: 'author.books.title',
          operator: '_eq',
          value: 'Sample Book',
        },
      ],
      groups: [],
    }),
  ).toMatchObject({
    author: {
      books: {
        title: {
          _eq: 'Sample Book',
        },
      },
    },
  });
});

test('should return and _and or _or operator if there are multiple rules in a group', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_or',
      rules: [
        { column: 'title', operator: '_eq', value: 'test' },
        { column: 'title', operator: '_eq', value: 'test2' },
      ],
      groups: [],
    }),
  ).toMatchObject({
    _or: [
      {
        title: {
          _eq: 'test',
        },
      },
      {
        title: {
          _eq: 'test2',
        },
      },
    ],
  });
});

test('should return a single array joined by _or if a nested group contains only one rule', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_or',
      rules: [
        {
          column: 'title',
          operator: '_eq',
          value: 'test',
        },
      ],
      groups: [
        {
          operator: '_and',
          rules: [
            {
              column: 'age',
              operator: '_neq',
              value: '20',
            },
          ],
          groups: [],
        },
      ],
    }),
  ).toMatchObject({
    _or: [
      {
        title: {
          _eq: 'test',
        },
      },
      {
        age: {
          _neq: '20',
        },
      },
    ],
  });
});

test('should return nested groups', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_or',
      rules: [
        {
          column: 'title',
          operator: '_eq',
          value: 'test',
        },
      ],
      groups: [
        {
          operator: '_and',
          rules: [
            {
              column: 'age',
              operator: '_neq',
              value: '20',
            },
            {
              column: 'age',
              operator: '_neq',
              value: '30',
            },
          ],
          groups: [],
        },
      ],
    }),
  ).toMatchObject({
    _or: [
      {
        title: {
          _eq: 'test',
        },
      },
      {
        _and: [
          {
            age: {
              _neq: '20',
            },
          },
          {
            age: {
              _neq: '30',
            },
          },
        ],
      },
    ],
  });
});

test('should merge unsupported rules into the object', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_or',
      rules: [
        {
          column: 'title',
          operator: '_eq',
          value: 'test',
        },
        {
          column: 'title',
          operator: '_eq',
          value: 'test2',
        },
      ],
      groups: [
        {
          operator: '_and',
          rules: [],
          groups: [],
          unsupported: [
            {
              _exists: {
                _table: { schema: 'public', name: 'authors' },
                _where: { name: { _eq: 'test3' } },
              },
            },
          ],
        },
      ],
      unsupported: [
        {
          _exists: {
            _table: { schema: 'public', name: 'authors' },
            _where: { name: { _eq: 'test3' } },
          },
        },
      ],
    }),
  ).toMatchObject({
    _or: [
      { title: { _eq: 'test' } },
      { title: { _eq: 'test2' } },
      {
        _and: [
          {
            _exists: {
              _table: { schema: 'public', name: 'authors' },
              _where: { name: { _eq: 'test3' } },
            },
          },
        ],
      },
      {
        _exists: {
          _table: { schema: 'public', name: 'authors' },
          _where: { name: { _eq: 'test3' } },
        },
      },
    ],
  });
});

test('should convert value to boolean if the operator is _is_null', () => {
  expect(
    convertToHasuraPermissions({
      operator: '_and',
      rules: [
        {
          column: 'title',
          operator: '_is_null',
          value: 'true',
        },
      ],
      groups: [],
    }),
  ).toMatchObject({
    title: {
      _is_null: true,
    },
  });
});
