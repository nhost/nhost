export interface NhostFunction {
  path: string;
  route: string;
  runtime: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  functionName: string;
  createdWithCommitSha: string;
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MultipartField {
  key: string;
  value: string;
  file: File | null;
}

export interface ResponseState {
  status: 'idle' | 'loading' | 'success' | 'error';
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  duration?: number;
}

export interface ExecuteFormValues {
  method: HttpMethod;
  contentType: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
  formFields: KeyValuePair[];
  multipartFields: MultipartField[];
}
