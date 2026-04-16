import buildServerlessFunctionRequestUrl from './buildServerlessFunctionRequestUrl';

describe('buildServerlessFunctionRequestUrl', () => {
  it('should return the base URL when there are no params', () => {
    expect(
      buildServerlessFunctionRequestUrl('https://example.com/api', []),
    ).toBe('https://example.com/api');
  });

  it('should append query params to the URL', () => {
    const params = [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ];
    expect(
      buildServerlessFunctionRequestUrl('https://example.com/api', params),
    ).toBe('https://example.com/api?page=1&limit=10');
  });

  it('should encode special characters in keys and values', () => {
    const params = [{ key: 'q', value: 'hello world' }];
    expect(
      buildServerlessFunctionRequestUrl('https://example.com/api', params),
    ).toBe('https://example.com/api?q=hello%20world');
  });

  it('should skip params with empty keys', () => {
    const params = [
      { key: '', value: 'ignored' },
      { key: 'keep', value: 'this' },
    ];
    expect(
      buildServerlessFunctionRequestUrl('https://example.com/api', params),
    ).toBe('https://example.com/api?keep=this');
  });

  it('should return the base URL when all param keys are empty', () => {
    const params = [
      { key: '', value: 'a' },
      { key: '', value: 'b' },
    ];
    expect(
      buildServerlessFunctionRequestUrl('https://example.com/api', params),
    ).toBe('https://example.com/api');
  });
});
