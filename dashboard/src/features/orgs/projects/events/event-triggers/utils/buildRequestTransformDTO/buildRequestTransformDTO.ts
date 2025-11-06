import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isNotEmptyValue } from '@/lib/utils';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';

export default function buildRequestTransformDTO(
  formValues: BaseEventTriggerFormValues,
): RequestTransformation {
  const requestTransform: RequestTransformation = {
    version: 2,
    template_engine: 'Kriti',
    url: `{{$base_url}}${formValues.requestOptionsTransform?.urlTemplate ?? ''}`,
  };

  let queryParams;
  if (
    formValues.requestOptionsTransform?.queryParams.queryParamsType ===
    'Key Value'
  ) {
    const { queryParams: queryParamsList } =
      formValues.requestOptionsTransform.queryParams;
    queryParams = queryParamsList.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  } else if (
    formValues.requestOptionsTransform?.queryParams.queryParamsType ===
    'URL string template'
  ) {
    queryParams = formValues.requestOptionsTransform.queryParams.queryParamsURL;
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
}
