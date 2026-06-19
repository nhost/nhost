import type { RequestTransformFormValues } from '@/features/orgs/projects/events/common/utils/buildRequestTransformDTO';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';
import { isBodyTransform } from '@/utils/hasura-api/guards';

type QueryParams =
  | {
      queryParams: { value: string; key: string }[];
      queryParamsType: 'Key Value';
    }
  | { queryParamsType: 'URL string template'; queryParamsURL: string };

function getRequestOptionsTransform(
  requestTransform?: RequestTransformation,
): RequestTransformFormValues['requestOptionsTransform'] {
  if (!requestTransform) {
    return undefined;
  }

  let queryParams: QueryParams;
  if (typeof requestTransform.query_params === 'string') {
    queryParams = {
      queryParamsType: 'URL string template',
      queryParamsURL: requestTransform.query_params,
    };
  } else if (typeof requestTransform.query_params === 'object') {
    queryParams = {
      queryParamsType: 'Key Value',
      queryParams: Object.entries(requestTransform.query_params).map(
        ([key, value]) => ({
          key,
          value,
        }),
      ),
    };
  } else {
    return undefined;
  }

  const urlTemplate = requestTransform.url
    ? requestTransform.url.replace(/^\{\{\$base_url\}\}/, '')
    : '';

  return {
    urlTemplate,
    method: requestTransform.method ?? 'POST',
    queryParams,
  };
}

function getPayloadTransform(
  sampleInput: string,
  requestTransform?: RequestTransformation,
): RequestTransformFormValues['payloadTransform'] {
  if (!requestTransform?.body || !isBodyTransform(requestTransform.body)) {
    return undefined;
  }

  switch (requestTransform.body.action) {
    case 'remove':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'disabled',
        },
        sampleInput,
      };
    case 'transform':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template: requestTransform.body.template ?? '',
        },
        sampleInput,
      };
    case 'x_www_form_urlencoded':
      return {
        requestBodyTransform: {
          requestBodyTransformType: 'application/x-www-form-urlencoded',
          formTemplate: Object.entries(
            requestTransform.body.form_template ?? {},
          ).map(([key, value]) => ({
            key,
            value,
          })),
        },
        sampleInput,
      };
    default: {
      const exhaustive: never = requestTransform.body.action;
      throw new Error(`Unexpected request body transform type: ${exhaustive}`);
    }
  }
}

export interface ParseRequestTransformParams {
  requestTransform?: RequestTransformation;
  sampleInput: string;
}

export default function parseRequestTransform({
  requestTransform,
  sampleInput,
}: ParseRequestTransformParams): RequestTransformFormValues {
  const requestOptionsTransform = getRequestOptionsTransform(requestTransform);
  const payloadTransform = getPayloadTransform(sampleInput, requestTransform);

  return {
    ...(requestOptionsTransform ? { requestOptionsTransform } : {}),
    ...(payloadTransform ? { payloadTransform } : {}),
  };
}
