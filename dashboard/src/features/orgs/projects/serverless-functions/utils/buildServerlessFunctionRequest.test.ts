import {
  buildRequestBody,
  buildRequestHeaders,
  buildRequestUrl,
} from './buildServerlessFunctionRequest';

describe('buildRequestUrl', () => {
  it('should return the base URL when there are no params', () => {
    expect(buildRequestUrl('https://example.com/api', [])).toBe(
      'https://example.com/api',
    );
  });

  it('should append query params to the URL', () => {
    const params = [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ];
    expect(buildRequestUrl('https://example.com/api', params)).toBe(
      'https://example.com/api?page=1&limit=10',
    );
  });

  it('should encode special characters in keys and values', () => {
    const params = [{ key: 'q', value: 'hello world' }];
    expect(buildRequestUrl('https://example.com/api', params)).toBe(
      'https://example.com/api?q=hello%20world',
    );
  });

  it('should skip params with empty keys', () => {
    const params = [
      { key: '', value: 'ignored' },
      { key: 'keep', value: 'this' },
    ];
    expect(buildRequestUrl('https://example.com/api', params)).toBe(
      'https://example.com/api?keep=this',
    );
  });

  it('should return the base URL when all param keys are empty', () => {
    const params = [
      { key: '', value: 'a' },
      { key: '', value: 'b' },
    ];
    expect(buildRequestUrl('https://example.com/api', params)).toBe(
      'https://example.com/api',
    );
  });
});

describe('buildRequestHeaders', () => {
  it('should convert header pairs to an object', () => {
    const pairs = [
      { key: 'Authorization', value: 'Bearer token' },
      { key: 'Accept', value: 'application/json' },
    ];
    expect(buildRequestHeaders(pairs, false)).toEqual({
      Authorization: 'Bearer token',
      Accept: 'application/json',
    });
  });

  it('should skip pairs with empty keys', () => {
    const pairs = [
      { key: '', value: 'ignored' },
      { key: 'X-Custom', value: 'value' },
    ];
    expect(buildRequestHeaders(pairs, false)).toEqual({
      'X-Custom': 'value',
    });
  });

  it('should remove Content-Type header when isMultipart is true', () => {
    const pairs = [
      { key: 'Content-Type', value: 'multipart/form-data' },
      { key: 'Authorization', value: 'Bearer token' },
    ];
    expect(buildRequestHeaders(pairs, true)).toEqual({
      Authorization: 'Bearer token',
    });
  });

  it('should keep Content-Type header when isMultipart is false', () => {
    const pairs = [{ key: 'Content-Type', value: 'application/json' }];
    expect(buildRequestHeaders(pairs, false)).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('should return an empty object for empty pairs', () => {
    expect(buildRequestHeaders([], false)).toEqual({});
  });
});

describe('buildRequestBody', () => {
  it('should return undefined for GET requests', () => {
    const result = buildRequestBody('GET', {
      isMultipart: false,
      isFormEncoded: false,
      body: '{"data": true}',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return undefined for HEAD requests', () => {
    const result = buildRequestBody('HEAD', {
      isMultipart: false,
      isFormEncoded: false,
      body: 'some body',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return raw body for POST with plain content', () => {
    const result = buildRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: false,
      body: '{"key": "value"}',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBe('{"key": "value"}');
  });

  it('should return undefined when raw body is empty', () => {
    const result = buildRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: false,
      body: '',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return URL-encoded string for form-encoded content', () => {
    const result = buildRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: true,
      body: '',
      formFields: [
        { key: 'name', value: 'John Doe' },
        { key: 'email', value: 'john@example.com' },
      ],
      multipartFields: [],
    });
    expect(result).toBe('name=John%20Doe&email=john%40example.com');
  });

  it('should skip form fields with empty keys', () => {
    const result = buildRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: true,
      body: '',
      formFields: [
        { key: '', value: 'skipped' },
        { key: 'valid', value: 'kept' },
      ],
      multipartFields: [],
    });
    expect(result).toBe('valid=kept');
  });

  it('should return undefined when all form fields have empty keys', () => {
    const result = buildRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: true,
      body: '',
      formFields: [{ key: '', value: 'skipped' }],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return FormData for multipart content', () => {
    const result = buildRequestBody('POST', {
      isMultipart: true,
      isFormEncoded: false,
      body: '',
      formFields: [],
      multipartFields: [
        { key: 'field1', value: 'text value', file: null },
        { key: 'field2', value: '', file: new File(['content'], 'test.txt') },
      ],
    });
    expect(result).toBeInstanceOf(FormData);
    const formData = result as FormData;
    expect(formData.get('field1')).toBe('text value');
    expect(formData.get('field2')).toBeInstanceOf(File);
  });

  it('should skip multipart fields with empty keys', () => {
    const result = buildRequestBody('PUT', {
      isMultipart: true,
      isFormEncoded: false,
      body: '',
      formFields: [],
      multipartFields: [
        { key: '', value: 'skipped', file: null },
        { key: 'valid', value: 'kept', file: null },
      ],
    });
    const formData = result as FormData;
    expect(formData.has('')).toBe(false);
    expect(formData.get('valid')).toBe('kept');
  });

  it('should work with PUT, PATCH, DELETE, and OPTIONS methods', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const) {
      const result = buildRequestBody(method, {
        isMultipart: false,
        isFormEncoded: false,
        body: 'test',
        formFields: [],
        multipartFields: [],
      });
      expect(result).toBe('test');
    }
  });
});
