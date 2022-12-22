import convertToHasuraPermissions from './convertToHasuraPermissions';

test('should return null if there are no rules or groups', () => {
  expect(convertToHasuraPermissions()).toBeNull();
  expect(convertToHasuraPermissions(null)).toBeNull();
  expect(convertToHasuraPermissions(undefined)).toBeNull();
});

test('should return an empty object if the input is an empty object', () => {
  expect(convertToHasuraPermissions({})).toMatchObject({});
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
