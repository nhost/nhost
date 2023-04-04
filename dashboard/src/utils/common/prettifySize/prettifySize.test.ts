import prettifySize from './prettifySize';

test('should return the input value if it is lower than the multiplier', () => {
  expect(prettifySize(980)).toBe('980 Bytes');
  expect(prettifySize(1500, { multiplier: 2000 })).toBe('1500 Bytes');
});

test('should return the converted value', () => {
  expect(prettifySize(1000)).toBe('1 KB');
  expect(prettifySize(1420)).toBe('1.42 KB');
  expect(prettifySize(54091776)).toBe('54.09 MB');
  expect(prettifySize(23475400000)).toBe('23.48 GB');
});

test('should return the converted value with custom multiplier', () => {
  expect(prettifySize(1024, { multiplier: 1024 })).toBe('1 KB');
  expect(prettifySize(1420, { multiplier: 1024 })).toBe('1.39 KB');
  expect(prettifySize(54091776, { multiplier: 1024 })).toBe('51.59 MB');
  expect(prettifySize(23475400000, { multiplier: 1024 })).toBe('21.86 GB');
});

test('should throw an error if the labels array is too short', () => {
  const customLabels = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];

  expect(() => prettifySize(1000, { labels: customLabels })).toThrow(
    'Labels must be an array with at least 9 elements.',
  );
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

  expect(prettifySize(1024, { labels: customLabels, multiplier: 1024 })).toBe(
    '1 KiB',
  );
  expect(prettifySize(1420, { labels: customLabels, multiplier: 1024 })).toBe(
    '1.39 KiB',
  );
  expect(
    prettifySize(54091776, { labels: customLabels, multiplier: 1024 }),
  ).toBe('51.59 MiB');
  expect(
    prettifySize(23475400000, { labels: customLabels, multiplier: 1024 }),
  ).toBe('21.86 GiB');
});
