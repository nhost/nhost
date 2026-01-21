import type {
  BodyTransform,
  HeaderWithEnv,
  HeaderWithValue,
} from './generated/schemas';

export function isHeaderWithEnvValue(
  header: HeaderWithEnv | HeaderWithValue,
): header is HeaderWithEnv {
  return 'value_from_env' in header && !('value' in header);
}

export function isHeaderWithValue(
  header: HeaderWithEnv | HeaderWithValue,
): header is HeaderWithValue {
  return !('value_from_env' in header) && 'value' in header;
}

export function isBodyTransform(
  body: BodyTransform | string,
): body is BodyTransform {
  return typeof body === 'object' && 'action' in body;
}
