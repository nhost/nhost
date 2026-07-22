import type {
  ActionItem,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import parseActionFormInitialData from './parseActionFormInitialData';

const customTypes: CustomTypes = {
  input_objects: [
    {
      name: 'SampleInput',
      fields: [
        { name: 'username', type: 'String!' },
        { name: 'password', type: 'String!' },
      ],
    },
  ],
  objects: [
    {
      name: 'SampleOutput',
      fields: [{ name: 'accessToken', type: 'String!' }],
    },
    {
      name: 'UnrelatedOutput',
      fields: [{ name: 'id', type: 'ID!' }],
    },
  ],
};

const action: ActionItem = {
  name: 'actionName',
  comment: 'something',
  definition: {
    handler: 'https://httpbin.org/post',
    output_type: 'SampleOutput',
    arguments: [{ name: 'arg1', type: 'SampleInput!' }],
    type: 'mutation',
    kind: 'synchronous',
    headers: [
      { name: 'X-From-Value', value: 'static' },
      { name: 'X-From-Env', value_from_env: 'SECRET_ENV_VAR' },
    ],
    forward_client_headers: true,
    ignored_client_headers: ['Content-Type'],
    timeout: 42,
  },
};

describe('parseActionFormInitialData', () => {
  it('parses an action into form initial data', () => {
    const { initialData } = parseActionFormInitialData(action, customTypes);

    expect(initialData).toEqual({
      actionDefinitionSdl: `type Mutation {
  actionName(arg1: SampleInput!): SampleOutput
}
`,
      typesSdl: `input SampleInput {
  username: String!
  password: String!
}

type SampleOutput {
  accessToken: String!
}
`,
      webhook: 'https://httpbin.org/post',
      kind: 'synchronous',
      comment: 'something',
      timeout: 42,
      forwardClientHeaders: true,
      headers: [
        { name: 'X-From-Value', type: 'fromValue', value: 'static' },
        { name: 'X-From-Env', type: 'fromEnv', value: 'SECRET_ENV_VAR' },
      ],
      sampleContext: [],
    });
  });

  it('returns the original type names referenced by the action', () => {
    const { originalTypeNames } = parseActionFormInitialData(
      action,
      customTypes,
    );

    expect(originalTypeNames).toEqual(['SampleInput', 'SampleOutput']);
  });

  it('applies defaults for omitted definition fields', () => {
    const { initialData } = parseActionFormInitialData(
      {
        name: 'minimalAction',
        definition: {
          handler: 'https://httpbin.org/post',
          output_type: 'SampleOutput',
          type: 'mutation',
        },
      },
      {},
    );

    expect(initialData.kind).toBe('synchronous');
    expect(initialData.comment).toBe('');
    expect(initialData.timeout).toBe(30);
    expect(initialData.forwardClientHeaders).toBe(false);
    expect(initialData.headers).toEqual([]);
    expect(initialData.typesSdl).toBe('');
  });

  it('parses request and payload transforms', () => {
    const { initialData } = parseActionFormInitialData(
      {
        ...action,
        definition: {
          ...action.definition,
          request_transform: {
            version: 2,
            template_engine: 'Kriti',
            method: 'POST',
            url: '{{$base_url}}/transformed',
            query_params: { id: '{{$body.input.arg1}}' },
            body: {
              action: 'transform',
              template: '{\n  "input": {{$body.input}}\n}',
            },
          },
        },
      },
      customTypes,
    );

    expect(initialData.requestOptionsTransform).toEqual({
      method: 'POST',
      urlTemplate: '/transformed',
      queryParams: {
        queryParamsType: 'Key Value',
        queryParams: [{ key: 'id', value: '{{$body.input.arg1}}' }],
      },
    });

    expect(initialData.payloadTransform?.requestBodyTransform).toEqual({
      requestBodyTransformType: 'application/json',
      template: '{\n  "input": {{$body.input}}\n}',
    });

    let sampleInput: unknown;
    try {
      sampleInput = JSON.parse(
        initialData.payloadTransform?.sampleInput ?? '{}',
      );
    } catch {
      throw new Error('sampleInput is not valid JSON');
    }
    expect(sampleInput).toEqual({
      action: { name: 'actionName' },
      input: { arg1: { username: 'username', password: 'password' } },
      session_variables: { 'x-hasura-role': 'user' },
      request_query: '',
    });
  });

  it('parses a response transform body template', () => {
    const { initialData } = parseActionFormInitialData(
      {
        ...action,
        definition: {
          ...action.definition,
          response_transform: {
            version: 2,
            template_engine: 'Kriti',
            body: {
              action: 'transform',
              template: '{\n  "base": {{$body.base_code}}\n}',
            },
          },
        },
      },
      customTypes,
    );

    expect(initialData.responseTransform).toEqual({
      template: '{\n  "base": {{$body.base_code}}\n}',
    });
  });

  it('omits the response transform when absent', () => {
    const { initialData } = parseActionFormInitialData(action, customTypes);
    expect(initialData.responseTransform).toBeUndefined();
  });
});
