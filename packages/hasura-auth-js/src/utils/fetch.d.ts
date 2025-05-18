import { NullableErrorResponse } from '../types';
interface FetchResponse<T> extends NullableErrorResponse {
    data: T;
}
export declare const postFetch: <T>(url: string, body: any, token?: string | null, extraHeaders?: HeadersInit) => Promise<FetchResponse<T>>;
export declare const getFetch: <T>(url: string, token?: string | null) => Promise<FetchResponse<T>>;
export {};
//# sourceMappingURL=fetch.d.ts.map