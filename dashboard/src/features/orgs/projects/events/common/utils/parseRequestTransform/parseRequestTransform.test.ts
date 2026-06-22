import type { RequestTransformFormValues } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';
import parseRequestTransform from './parseRequestTransform';

const sampleInput = '{\n  "input": {}\n}';

describe('parseRequestTransform', () => {
  it('returns an empty object when there is no request transform', () => {
    const result = parseRequestTransform({
      requestTransform: undefined,
      sampleInput,
    });

    expect(result).toEqual({});
  });

  it('parses key/value query params and strips the base url prefix', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      method: 'PATCH',
      url: '{{$base_url}}/template',
      query_params: { key: 'value', key2: 'value2' },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.requestOptionsTransform).toEqual({
      method: 'PATCH',
      urlTemplate: '/template',
      queryParams: {
        queryParamsType: 'Key Value',
        queryParams: [
          { key: 'key', value: 'value' },
          { key: 'key2', value: 'value2' },
        ],
      },
    });
    expect(result.payloadTransform).toBeUndefined();
  });

  it('parses a url string template for the query params', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      url: '{{$base_url}}/template',
      query_params: 'mytemplateurlstring=123',
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.requestOptionsTransform).toEqual({
      method: 'POST',
      urlTemplate: '/template',
      queryParams: {
        queryParamsType: 'URL string template',
        queryParamsURL: 'mytemplateurlstring=123',
      },
    });
  });

  it('defaults the method to POST and the url template to an empty string', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      query_params: {},
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.requestOptionsTransform).toEqual({
      method: 'POST',
      urlTemplate: '',
      queryParams: {
        queryParamsType: 'Key Value',
        queryParams: [],
      },
    });
  });

  it('omits the request options transform when query params are absent', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'transform',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.requestOptionsTransform).toBeUndefined();
  });

  it('preserves the method and url when query params are absent', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      method: 'GET',
      url: '{{$base_url}}/template',
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.requestOptionsTransform).toEqual({
      method: 'GET',
      urlTemplate: '/template',
      queryParams: {
        queryParamsType: 'Key Value',
        queryParams: [],
      },
    });
  });

  it('parses an application/json body transform and passes the sample input through', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'transform',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    const expected: RequestTransformFormValues['payloadTransform'] = {
      sampleInput,
      requestBodyTransform: {
        requestBodyTransformType: 'application/json',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    };

    expect(result.payloadTransform).toEqual(expected);
  });

  it('parses a disabled body transform', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'remove',
      },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.payloadTransform).toEqual({
      sampleInput,
      requestBodyTransform: {
        requestBodyTransformType: 'disabled',
      },
    });
  });

  it('parses an x-www-form-urlencoded body transform', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'x_www_form_urlencoded',
        form_template: {
          base_url: '{{$base_url}}',
          somekey: 'somevalue',
        },
      },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result.payloadTransform).toEqual({
      sampleInput,
      requestBodyTransform: {
        requestBodyTransformType: 'application/x-www-form-urlencoded',
        formTemplate: [
          { key: 'base_url', value: '{{$base_url}}' },
          { key: 'somekey', value: 'somevalue' },
        ],
      },
    });
  });

  it('parses both request options and payload transforms together', () => {
    const requestTransform: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      method: 'POST',
      url: '{{$base_url}}/template',
      query_params: { somekey: 'somevalue' },
      body: {
        action: 'transform',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    };

    const result = parseRequestTransform({ requestTransform, sampleInput });

    expect(result).toEqual({
      requestOptionsTransform: {
        method: 'POST',
        urlTemplate: '/template',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [{ key: 'somekey', value: 'somevalue' }],
        },
      },
      payloadTransform: {
        sampleInput,
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template: '{\n  "input": {{$body.input}}\n}',
        },
      },
    });
  });
});
