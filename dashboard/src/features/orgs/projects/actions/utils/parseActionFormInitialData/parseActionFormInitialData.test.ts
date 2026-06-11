import { describe, expect, it } from 'vitest';
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
    const result = parseActionFormInitialData(action, customTypes);

    expect(result).toEqual({
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

  it('applies defaults for omitted definition fields', () => {
    const result = parseActionFormInitialData(
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

    expect(result.kind).toBe('synchronous');
    expect(result.comment).toBe('');
    expect(result.timeout).toBe(30);
    expect(result.forwardClientHeaders).toBe(false);
    expect(result.headers).toEqual([]);
    expect(result.typesSdl).toBe('');
  });

  it('parses request and payload transforms', () => {
    const result = parseActionFormInitialData(
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

    expect(result.requestOptionsTransform).toEqual({
      method: 'POST',
      urlTemplate: '/transformed',
      queryParams: {
        queryParamsType: 'Key Value',
        queryParams: [{ key: 'id', value: '{{$body.input.arg1}}' }],
      },
    });

    expect(result.payloadTransform).toEqual({
      sampleInput: JSON.stringify(
        {
          action: { name: 'actionName' },
          input: { arg1: 'sample_value' },
          session_variables: { 'x-hasura-role': 'user' },
          request_query: '',
        },
        null,
        2,
      ),
      requestBodyTransform: {
        requestBodyTransformType: 'application/json',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    });
  });
});
