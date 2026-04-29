import buildServerlessFunctionRequestBody from './buildServerlessFunctionRequestBody';

describe('buildServerlessFunctionRequestBody', () => {
  it('should return undefined for GET requests', () => {
    const result = buildServerlessFunctionRequestBody('GET', {
      isMultipart: false,
      isFormEncoded: false,
      body: '{"data": true}',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return undefined for HEAD requests', () => {
    const result = buildServerlessFunctionRequestBody('HEAD', {
      isMultipart: false,
      isFormEncoded: false,
      body: 'some body',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return raw body for POST with plain content', () => {
    const result = buildServerlessFunctionRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: false,
      body: '{"key": "value"}',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBe('{"key": "value"}');
  });

  it('should return undefined when raw body is empty', () => {
    const result = buildServerlessFunctionRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: false,
      body: '',
      formFields: [],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return URL-encoded string for form-encoded content', () => {
    const result = buildServerlessFunctionRequestBody('POST', {
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
    const result = buildServerlessFunctionRequestBody('POST', {
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
    const result = buildServerlessFunctionRequestBody('POST', {
      isMultipart: false,
      isFormEncoded: true,
      body: '',
      formFields: [{ key: '', value: 'skipped' }],
      multipartFields: [],
    });
    expect(result).toBeUndefined();
  });

  it('should return FormData for multipart content', () => {
    const result = buildServerlessFunctionRequestBody('POST', {
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
    const result = buildServerlessFunctionRequestBody('PUT', {
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
      const result = buildServerlessFunctionRequestBody(method, {
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
