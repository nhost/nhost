import type {
  BodyTransform,
  HeadersItem,
  HeaderWithEnv,
  HeaderWithValue,
  RequestTransformationBody,
} from './generated/schemas';

export function isHeaderWithEnvValue(
  header: HeadersItem,
): header is HeaderWithEnv {
  return 'value_from_env' in header && !('value' in header);
}

export function isHeaderWithValue(
  header: HeadersItem,
): header is HeaderWithValue {
  return !('value_from_env' in header) && 'value' in header;
}

export function isBodyTransform(
  body: RequestTransformationBody,
): body is BodyTransform {
  return typeof body === 'object' && 'action' in body;
}
