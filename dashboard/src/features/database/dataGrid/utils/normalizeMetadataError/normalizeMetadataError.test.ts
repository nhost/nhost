import type { MetadataError } from '@/features/database/dataGrid/types/dataBrowser';
import normalizeMetadataError from './normalizeMetadataError';

const baseMetadataError = {
  code: 'P0001',
  path: '$[0]',
  error: 'some-error',
};

test(`should not extract any error messages if response is an empty object`, () => {
  expect(normalizeMetadataError({})).toBe('Unknown error occurred.');
});

test('should not extract any error messages if response is not a query error', () => {
  expect(normalizeMetadataError({ errorCode: 2, status: 500 })).toBe(
    'Unknown error occurred.',
  );
});

test('should return the first internal error message if response is a metadata error', () => {
  const metadataError: MetadataError = {
    ...baseMetadataError,
    internal: [
      {
        reason: 'some-reason',
        name: 'internal-error',
        type: 'error',
        definition: { source: 'default', name: 'default' },
        table: {
          schema: 'public',
          name: 'tests',
        },
      },
    ],
  };

  expect(normalizeMetadataError(metadataError)).toBe('some-reason');
});

test('should not extroct any error messages if the list of internal errors is empty', () => {
  const metadataError: MetadataError = {
    ...baseMetadataError,
    internal: [],
  };

  expect(normalizeMetadataError(metadataError)).toBe('Unknown error occurred.');
});
