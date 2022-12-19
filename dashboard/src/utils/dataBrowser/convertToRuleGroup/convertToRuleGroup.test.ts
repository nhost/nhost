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

test('should convert a simple Hasura permission object to a rule group', () => {
  expect(convertToRuleGroup({ title: { _eq: 'test' } })).toMatchObject({
    operator: '_and',
    rules: [{ column: 'title', operator: '_eq', value: 'test' }],
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

  expect(
    convertToRuleGroup({
      _or: [
        {
          author: {
            _and: [{ name: { _eq: 'John Doe' } }, { age: { _gte: '32' } }],
          },
        },
        { title: { _eq: 'test' } },
        { publisher: { name: { _eq: 'Test Publisher' } } },
      ],
    }),
  ).toMatchObject({
    operator: '_or',
    rules: [
      { column: 'title', operator: '_eq', value: 'test' },
      { column: 'publisher.name', operator: '_eq', value: 'Test Publisher' },
    ],
    groups: [
      {
        operator: '_and',
        rules: [
          { column: 'author.name', operator: '_eq', value: 'John Doe' },
          { column: 'author.age', operator: '_gte', value: '32' },
        ],
        groups: [],
      },
    ],
  });
});

test(`should convert an _in or _nin value that do not have an array as value to _in_hasura or _nin_hasura`, () => {
  expect(
    convertToRuleGroup({ title: { _in: ['X-Hasura-Allowed-Ids'] } }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      {
        column: 'title',
        operator: '_in',
        value: ['X-Hasura-Allowed-Ids'],
      },
    ],
    groups: [],
  });

  expect(
    convertToRuleGroup({ title: { _in: 'X-Hasura-Allowed-Ids' } }),
  ).toMatchObject({
    operator: '_and',
    rules: [
      {
        column: 'title',
        operator: '_in_hasura',
        value: 'X-Hasura-Allowed-Ids',
      },
    ],
    groups: [],
  });
});
