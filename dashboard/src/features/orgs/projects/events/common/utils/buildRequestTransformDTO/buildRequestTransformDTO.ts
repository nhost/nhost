import { isNotEmptyValue } from '@/lib/utils';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';

export interface RequestTransformFormValues {
  requestOptionsTransform?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    urlTemplate?: string;
    queryParams:
      | {
          queryParamsType: 'Key Value';
          queryParams: Array<{ key: string; value: string }>;
        }
      | {
          queryParamsType: 'URL string template';
          queryParamsURL: string;
        };
  };
  payloadTransform?: {
    sampleInput: string;
    requestBodyTransform:
      | { requestBodyTransformType: 'disabled' }
      | { requestBodyTransformType: 'application/json'; template: string }
      | {
          requestBodyTransformType: 'application/x-www-form-urlencoded';
          formTemplate: Array<{ key: string; value: string }>;
        };
  };
}

export default function buildRequestTransformDTO(
  formValues: RequestTransformFormValues,
): RequestTransformation | undefined {
  if (!formValues.requestOptionsTransform && !formValues.payloadTransform) {
    return undefined;
  }

  const requestTransform: RequestTransformation = {
    version: 2,
    template_engine: 'Kriti',
    ...(formValues.requestOptionsTransform && {
      method: formValues.requestOptionsTransform.method,
    }),
  };
  const urlTemplate = formValues.requestOptionsTransform?.urlTemplate;

  if (isNotEmptyValue(urlTemplate)) {
    requestTransform.url = `{{$base_url}}${urlTemplate}`;
  }

  let queryParams: string | Record<string, string> | null = null;
  if (
    formValues.requestOptionsTransform?.queryParams.queryParamsType ===
    'Key Value'
  ) {
    const { queryParams: queryParamsList } =
      formValues.requestOptionsTransform.queryParams;
    queryParams = queryParamsList.reduce<Record<string, string>>(
      (acc, item) => {
        // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
        acc[item.key] = item.value;
        return acc;
      },
      {},
    );
  } else if (
    formValues.requestOptionsTransform?.queryParams.queryParamsType ===
    'URL string template'
  ) {
    queryParams = formValues.requestOptionsTransform.queryParams.queryParamsURL;
  }
  if (isNotEmptyValue(queryParams)) {
    requestTransform.query_params = queryParams;
  }

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
              // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
              acc[item.key] = item.value;
              return acc;
            },
            {},
          ),
        };
        requestTransform.request_headers = {
          add_headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          remove_headers: ['content-type'],
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
