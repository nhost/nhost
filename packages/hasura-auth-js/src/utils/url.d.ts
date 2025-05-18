import { RedirectOption } from '../types';
export declare const encodeQueryParameters: (baseUrl: string, parameters?: Record<string, unknown>) => string;
/**
 * Transform options that include a redirectTo property so the
 * redirect url is absolute, given a base clientUrl.
 * If no client url is given, any relative redirectUrl is removed while
 * the other options are sent as-is.
 * @param clientUrl base client url
 * @param options
 * @returns
 */
export declare const rewriteRedirectTo: <T extends RedirectOption>(clientUrl?: string, options?: T) => (Omit<T, "redirectTo"> & {
    redirectTo?: string;
}) | undefined;
export declare function getParameterByName(name: string, url?: string): string | null | undefined;
export declare function removeParameterFromWindow(name: string): void;
//# sourceMappingURL=url.d.ts.map