import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';
import buildActionDTO from './buildActionDTO';

const formValues: BaseActionFormValues = {
  actionDefinitionSdl: `type Mutation {
  actionName(arg1: SampleInput!): SampleOutput
}`,
  typesSdl: `type SampleOutput {
  accessToken: String!
}

input SampleInput {
  username: String!
  password: String!
}`,
  webhook: 'https://httpbin.org/post',
  kind: 'synchronous',
  comment: 'something',
  timeout: 30,
  forwardClientHeaders: false,
  headers: [
    { name: 'X-From-Value', type: 'fromValue', value: 'static' },
    { name: 'X-From-Env', type: 'fromEnv', value: 'SECRET_ENV_VAR' },
  ],
  requestOptionsTransform: undefined,
  payloadTransform: undefined,
};

describe('buildActionDTO', () => {
  it('builds a create action DTO with merged custom types', () => {
    const { actionArgs, customTypesArgs } = buildActionDTO({
      formValues,
      existingCustomTypes: {
        objects: [
          {
            name: 'OtherOutput',
            fields: [{ name: 'id', type: 'ID!' }],
          },
        ],
      },
    });

    expect(actionArgs).toEqual({
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
        forward_client_headers: false,
        timeout: 30,
      },
    });

    expect(customTypesArgs).toEqual({
      scalars: [],
      enums: [],
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
          name: 'OtherOutput',
          fields: [{ name: 'id', type: 'ID!' }],
        },
        {
          name: 'SampleOutput',
          fields: [{ name: 'accessToken', type: 'String!' }],
        },
      ],
    });
  });

  it('includes the request transform when transforms are configured', () => {
    const { actionArgs } = buildActionDTO({
      formValues: {
        ...formValues,
        requestOptionsTransform: {
          method: 'POST',
          urlTemplate: '/transformed',
          queryParams: {
            queryParamsType: 'Key Value',
            queryParams: [{ key: 'id', value: '{{$body.input.arg1}}' }],
          },
        },
        payloadTransform: {
          sampleInput: '{}',
          requestBodyTransform: {
            requestBodyTransformType: 'application/json',
            template: '{\n  "input": {{$body.input}}\n}',
          },
        },
      },
      existingCustomTypes: {},
    });

    expect(actionArgs.definition.request_transform).toEqual({
      version: 2,
      template_engine: 'Kriti',
      method: 'POST',
      url: '{{$base_url}}/transformed',
      query_params: { id: '{{$body.input.arg1}}' },
      body: {
        action: 'transform',
        template: '{\n  "input": {{$body.input}}\n}',
      },
    });
  });

  it('omits the kind for query actions', () => {
    const { actionArgs } = buildActionDTO({
      formValues: {
        ...formValues,
        actionDefinitionSdl: `type Query {
  currentTime: SampleOutput
}`,
      },
      existingCustomTypes: {},
    });

    expect(actionArgs.definition.type).toBe('query');
    expect(actionArgs.definition.kind).toBeUndefined();
  });

  it('preserves definition fields that the form does not manage', () => {
    const originalAction: ActionItem = {
      name: 'actionName',
      definition: {
        handler: 'https://old-handler.example.com',
        output_type: 'SampleOutput',
        type: 'mutation',
        kind: 'asynchronous',
        ignored_client_headers: ['Content-Type', 'User-Agent'],
      },
    };

    const { actionArgs } = buildActionDTO({
      formValues,
      existingCustomTypes: {},
      originalAction,
    });

    expect(actionArgs.definition.ignored_client_headers).toEqual([
      'Content-Type',
      'User-Agent',
    ]);
    expect(actionArgs.definition.handler).toBe('https://httpbin.org/post');
    expect(actionArgs.definition.kind).toBe('synchronous');
  });

  it('builds a response transform when configured', () => {
    const { actionArgs } = buildActionDTO({
      formValues: {
        ...formValues,
        responseTransform: {
          template: '{\n  "base": {{$body.base_code}}\n}',
        },
      },
      existingCustomTypes: {},
    });

    expect(actionArgs.definition.response_transform).toEqual({
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'transform',
        template: '{\n  "base": {{$body.base_code}}\n}',
      },
    });
  });

  it('drops the response transform when the form removes it', () => {
    const originalAction: ActionItem = {
      name: 'actionName',
      definition: {
        handler: 'https://old-handler.example.com',
        output_type: 'SampleOutput',
        type: 'mutation',
        response_transform: {
          version: 2,
          template_engine: 'Kriti',
          body: { action: 'transform', template: '{}' },
        },
      },
    };

    const { actionArgs } = buildActionDTO({
      formValues: { ...formValues, responseTransform: undefined },
      existingCustomTypes: {},
      originalAction,
    });

    expect(actionArgs.definition.response_transform).toBeUndefined();
  });

  it('preserves relationships of re-defined object types', () => {
    const { customTypesArgs } = buildActionDTO({
      formValues,
      existingCustomTypes: {
        objects: [
          {
            name: 'SampleOutput',
            fields: [{ name: 'accessToken', type: 'String!' }],
            relationships: [
              {
                name: 'user',
                type: 'object',
                remote_table: { schema: 'public', name: 'users' },
                field_mapping: { userId: 'id' },
              },
            ],
          },
        ],
      },
    });

    expect(customTypesArgs.objects).toEqual([
      {
        name: 'SampleOutput',
        fields: [{ name: 'accessToken', type: 'String!' }],
        relationships: [
          {
            name: 'user',
            type: 'object',
            remote_table: { schema: 'public', name: 'users' },
            field_mapping: { userId: 'id' },
          },
        ],
      },
    ]);
  });

  it('throws when the action definition SDL is invalid', () => {
    expect(() =>
      buildActionDTO({
        formValues: { ...formValues, actionDefinitionSdl: 'type Mutation {' },
        existingCustomTypes: {},
      }),
    ).toThrow();
  });
});
