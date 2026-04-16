import type {
  HttpMethod,
  KeyValuePair,
  MultipartField,
} from '@/features/orgs/projects/serverless-functions/types';

export default function buildServerlessFunctionRequestBody(
  method: HttpMethod,
  opts: {
    isMultipart: boolean;
    isFormEncoded: boolean;
    body: string;
    formFields: KeyValuePair[];
    multipartFields: MultipartField[];
  },
): BodyInit | undefined {
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (!hasBody) {
    return undefined;
  }

  if (opts.isMultipart) {
    const formData = new FormData();
    for (const field of opts.multipartFields) {
      if (field.key) {
        if (field.file) {
          formData.append(field.key, field.file);
        } else {
          formData.append(field.key, field.value);
        }
      }
    }
    return formData;
  }

  if (opts.isFormEncoded) {
    const encoded = opts.formFields
      .filter((f) => f.key)
      .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&');
    return encoded || undefined;
  }

  return opts.body || undefined;
}
