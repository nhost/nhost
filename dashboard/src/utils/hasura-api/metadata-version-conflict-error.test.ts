import {
  classifyMetadataVersionConflictResponse,
  classifyMigrationMetadataVersionConflictResponse,
  MetadataVersionConflictError,
} from '@/utils/hasura-api/metadata-version-conflict-error';

const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const DIRECT_HASURA_CONFLICT = {
  status: 409,
  data: {
    path: '$',
    error: CONFLICT_MESSAGE,
    code: 'conflict',
  },
};
const MIGRATION_API_CONFLICT = {
  status: 400,
  data: {
    code: 'data_api_error',
    message: JSON.stringify(DIRECT_HASURA_CONFLICT.data),
  },
};

describe('classifyMetadataVersionConflictResponse', () => {
  it('accepts the canonical Hasura 409 response', () => {
    expect(
      classifyMetadataVersionConflictResponse(DIRECT_HASURA_CONFLICT),
    ).toEqual({ message: CONFLICT_MESSAGE });
  });

  it.each([
    ['wrong status', { ...DIRECT_HASURA_CONFLICT, status: 400 }],
    [
      'wrong code',
      {
        ...DIRECT_HASURA_CONFLICT,
        data: { ...DIRECT_HASURA_CONFLICT.data, code: 'constraint-violation' },
      },
    ],
    [
      'wrong message',
      {
        ...DIRECT_HASURA_CONFLICT,
        data: {
          ...DIRECT_HASURA_CONFLICT.data,
          error: `${CONFLICT_MESSAGE}. Please retry.`,
        },
      },
    ],
    [
      'message in the wrong field',
      {
        status: 409,
        data: { code: 'conflict', message: CONFLICT_MESSAGE },
      },
    ],
    ['ordinary 409', { status: 409, data: { error: 'already exists' } }],
    ['missing data', { status: 409 }],
    ['malformed data', { status: 409, data: [] }],
  ])('rejects %s', (_name, response) => {
    expect(classifyMetadataVersionConflictResponse(response)).toBeNull();
  });
});

describe('classifyMigrationMetadataVersionConflictResponse', () => {
  it('accepts the migrations API data_api_error envelope', () => {
    expect(
      classifyMigrationMetadataVersionConflictResponse(MIGRATION_API_CONFLICT),
    ).toEqual({ message: CONFLICT_MESSAGE });
  });

  it.each([
    ['wrong status', { ...MIGRATION_API_CONFLICT, status: 409 }],
    [
      'wrong outer code',
      {
        ...MIGRATION_API_CONFLICT,
        data: { ...MIGRATION_API_CONFLICT.data, code: 'internal_error' },
      },
    ],
    [
      'unserialized direct response',
      { status: 400, data: DIRECT_HASURA_CONFLICT.data },
    ],
    [
      'malformed serialized response',
      {
        ...MIGRATION_API_CONFLICT,
        data: { code: 'data_api_error', message: '{not-json' },
      },
    ],
    [
      'nested conflict',
      {
        ...MIGRATION_API_CONFLICT,
        data: {
          code: 'data_api_error',
          message: JSON.stringify({ cause: DIRECT_HASURA_CONFLICT.data }),
        },
      },
    ],
    [
      'wrong inner code',
      {
        ...MIGRATION_API_CONFLICT,
        data: {
          code: 'data_api_error',
          message: JSON.stringify({
            ...DIRECT_HASURA_CONFLICT.data,
            code: 'bad-request',
          }),
        },
      },
    ],
    [
      'oversized message',
      {
        ...MIGRATION_API_CONFLICT,
        data: {
          code: 'data_api_error',
          message: JSON.stringify({
            ...DIRECT_HASURA_CONFLICT.data,
            padding: 'x'.repeat(2_048),
          }),
        },
      },
    ],
  ])('rejects %s', (_name, response) => {
    expect(
      classifyMigrationMetadataVersionConflictResponse(response),
    ).toBeNull();
  });
});

describe('MetadataVersionConflictError', () => {
  it.each([
    'https://test.hasura.eu-west-1.nhost.run',
    'http://localhost:8080/custom-hasura-path',
  ])('retains the safe configured Hasura target %s', (appUrl) => {
    const error = new MetadataVersionConflictError(CONFLICT_MESSAGE, appUrl);

    expect(error).toMatchObject({
      name: 'MetadataVersionConflictError',
      message: CONFLICT_MESSAGE,
      origin: { appUrl },
    });
    expect(Object.isFrozen(error.origin)).toBe(true);
  });

  it.each([
    undefined,
    'not-a-url',
    'ftp://hasura.example.com',
    'https://admin:secret@hasura.example.com',
    'https://hasura.example.com?adminSecret=secret',
    'https://hasura.example.com#secret',
  ])('fails closed for an unknown or unsafe origin', (appUrl) => {
    const error = new MetadataVersionConflictError(CONFLICT_MESSAGE, appUrl);

    expect(error.origin).toBeNull();
    expect(JSON.stringify(error)).not.toContain('secret');
  });
});
