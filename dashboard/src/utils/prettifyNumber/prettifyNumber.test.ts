import prettifyNumber from './prettifyNumber';

test('should throw an error if multiplier is lower than 0', () => {
  expect(() => prettifyNumber(1000, { multiplier: -1 })).toThrowError(
    'Multiplier must be greater than 0',
  );
});

test('should return the input value if it is lower than the multiplier', () => {
  expect(prettifyNumber(980)).toBe('980');
  expect(prettifyNumber(-980)).toBe('-980');
  expect(prettifyNumber(1500, { multiplier: 2000 })).toBe('1500');
  expect(prettifyNumber(-1500, { multiplier: 2000 })).toBe('-1500');
});

test('should return the converted value', () => {
  expect(prettifyNumber(1000)).toBe('1k');
  expect(prettifyNumber(-1000)).toBe('-1k');
  expect(prettifyNumber(1420)).toBe('1.42k');
  expect(prettifyNumber(-1420)).toBe('-1.42k');
  expect(prettifyNumber(54091776)).toBe('54.09M');
  expect(prettifyNumber(-54091776)).toBe('-54.09M');
  expect(prettifyNumber(23475400000)).toBe('23.48B');
  expect(prettifyNumber(-23475400000)).toBe('-23.48B');
});

test('should return the converted value with custom multiplier', () => {
  expect(prettifyNumber(1024, { multiplier: 1024 })).toBe('1k');
  expect(prettifyNumber(1420, { multiplier: 1024 })).toBe('1.39k');
  expect(prettifyNumber(54091776, { multiplier: 1024 })).toBe('51.59M');
  expect(prettifyNumber(23475400000, { multiplier: 1024 })).toBe('21.86B');
});

test('should be able to change the labels', () => {
  const customLabels = [
    'Bytes',
    'KiB',
    'MiB',
    'GiB',
    'TiB',
    'PiB',
    'EiB',
    'ZiB',
    'YiB',
  ];

  expect(prettifyNumber(1024, { labels: customLabels, multiplier: 1024 })).toBe(
    '1KiB',
  );
  expect(prettifyNumber(1420, { labels: customLabels, multiplier: 1024 })).toBe(
    '1.39KiB',
  );
  expect(
    prettifyNumber(54091776, { labels: customLabels, multiplier: 1024 }),
  ).toBe('51.59MiB');
  expect(
    prettifyNumber(23475400000, { labels: customLabels, multiplier: 1024 }),
  ).toBe('21.86GiB');
});

test('should be able to change the separator', () => {
  expect(prettifyNumber(1024, { separator: ' ' })).toBe('1.02 k');
  expect(prettifyNumber(1420, { separator: ' ' })).toBe('1.42 k');
  expect(prettifyNumber(54091776, { separator: ' ' })).toBe('54.09 M');
  expect(prettifyNumber(23475400000, { separator: ' ' })).toBe('23.48 B');
});

test('should be able to change the number of decimals', () => {
  expect(prettifyNumber(1024, { numberOfDecimals: 0 })).toBe('1k');
  expect(prettifyNumber(1420, { numberOfDecimals: 0 })).toBe('1k');
  expect(prettifyNumber(54091776, { numberOfDecimals: 0 })).toBe('54M');
  expect(prettifyNumber(23475400000, { numberOfDecimals: 0 })).toBe('23B');
});

test('should always use the last available label if the value is too large', () => {
  expect(prettifyNumber(10000000, { labels: ['Bytes', 'KB'] })).toBe('10000KB');

  expect(prettifyNumber(10000, { labels: [] })).toBe('10000');
});
