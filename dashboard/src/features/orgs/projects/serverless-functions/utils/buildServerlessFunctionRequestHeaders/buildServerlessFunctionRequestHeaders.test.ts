import buildServerlessFunctionRequestHeaders from './buildServerlessFunctionRequestHeaders';

describe('buildServerlessFunctionRequestHeaders', () => {
  it('should convert header pairs to an object', () => {
    const pairs = [
      { key: 'Authorization', value: 'Bearer token' },
      { key: 'Accept', value: 'application/json' },
    ];
    expect(buildServerlessFunctionRequestHeaders(pairs, false)).toEqual({
      Authorization: 'Bearer token',
      Accept: 'application/json',
    });
  });

  it('should skip pairs with empty keys', () => {
    const pairs = [
      { key: '', value: 'ignored' },
      { key: 'X-Custom', value: 'value' },
    ];
    expect(buildServerlessFunctionRequestHeaders(pairs, false)).toEqual({
      'X-Custom': 'value',
    });
  });

  it('should remove Content-Type header when isMultipart is true', () => {
    const pairs = [
      { key: 'Content-Type', value: 'multipart/form-data' },
      { key: 'Authorization', value: 'Bearer token' },
    ];
    expect(buildServerlessFunctionRequestHeaders(pairs, true)).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('should keep Content-Type header when isMultipart is false', () => {
    const pairs = [{ key: 'Content-Type', value: 'application/json' }];
    expect(buildServerlessFunctionRequestHeaders(pairs, false)).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('should remove lowercase content-type header when isMultipart is true', () => {
    const pairs = [
      { key: 'content-type', value: 'multipart/form-data' },
      { key: 'Authorization', value: 'Bearer token' },
    ];
    expect(buildServerlessFunctionRequestHeaders(pairs, true)).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('should remove mixed-case CONTENT-TYPE header when isMultipart is true', () => {
    const pairs = [
      { key: 'CONTENT-TYPE', value: 'multipart/form-data' },
      { key: '  Content-type  ', value: 'multipart/form-data' },
      { key: 'Authorization', value: 'Bearer token' },
    ];
    expect(buildServerlessFunctionRequestHeaders(pairs, true)).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('should preserve user-supplied content-type when isMultipart is false', () => {
    const pairs = [{ key: 'content-type', value: 'application/json' }];
    expect(buildServerlessFunctionRequestHeaders(pairs, false)).toEqual({
      'content-type': 'application/json',
    });
  });

  it('should return an empty object for empty pairs', () => {
    expect(buildServerlessFunctionRequestHeaders([], false)).toEqual({});
  });
});
