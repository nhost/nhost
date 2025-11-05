import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isNotEmptyValue } from '@/lib/utils';
import type {
  RequestTransformation,
  TestWebhookTransformArgs,
} from '@/utils/hasura-api/generated/schemas';

export interface BuildWebhookTransformDTOParams {
  formValues: BaseEventTriggerFormValues;
}

const getRequestTransform = (
  formValues: BaseEventTriggerFormValues,
): RequestTransformation => {
  const requestTransform: RequestTransformation = {
    version: 2,
    template_engine: 'Kriti',
    url: `{{$base_url}}${formValues.requestTransform?.urlTemplate ?? ''}`,
  };

  let queryParams;
  if (
    formValues.requestTransform?.queryParams.queryParamsType === 'Key Value'
  ) {
    const { queryParams: queryParamsList } =
      formValues.requestTransform.queryParams;
    queryParams = queryParamsList.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  } else if (
    formValues.requestTransform?.queryParams.queryParamsType ===
    'URL string template'
  ) {
    queryParams = formValues.requestTransform.queryParams.queryParamsURL;
  }
  requestTransform.query_params = queryParams;

  const requestBodyTransform =
    formValues.payloadTransform?.requestBodyTransform;

  if (isNotEmptyValue(requestBodyTransform)) {
    const { requestBodyTransformType } = requestBodyTransform;
    switch (requestBodyTransformType) {
      case 'disabled':
        requestTransform.body = {
          action: 'remove',
        };
        break;
      case 'application/json':
        requestTransform.body = {
          action: 'transform',
          template: requestBodyTransform.template,
        };
        break;
      case 'application/x-www-form-urlencoded':
        requestTransform.body = {
          action: 'x_www_form_urlencoded',
          form_template: requestBodyTransform.formTemplate.reduce(
            (acc, item) => {
              acc[item.key] = item.value;
              return acc;
            },
            {},
          ),
        };
        break;
      default: {
        const exhaustive: never = requestBodyTransformType;
        throw new Error(
          `Unexpected request body transform type: ${exhaustive}`,
        );
      }
    }
  }

  return requestTransform;
};

export default function buildTestWebhookTransformDTO({
  formValues,
}: BuildWebhookTransformDTOParams): TestWebhookTransformArgs {
  let body = {};
  try {
    body = formValues.payloadTransform?.sampleInput
      ? JSON.parse(formValues.payloadTransform.sampleInput)
      : null;
  } catch (error) {
    throw new Error('Invalid sample input. Please enter a valid JSON string.');
  }

  const env = formValues.sampleContext.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  const requestTransform = getRequestTransform(formValues);

  return {
    webhook_url: formValues.webhook ?? '',
    body,
    env,
    session_variables: {
      'x-hasura-admin-secret': 'xxx',
    },
    request_transform: requestTransform,
  };
}
