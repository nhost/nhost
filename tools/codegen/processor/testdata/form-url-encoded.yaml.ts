/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * Optional token type hint declared nullable in OpenAPI.
 */
export type OAuth2RevokeRequestToken_type_hint = "access_token" | "refresh_token";


/**
 * 
 @property token (`string`) - 
 @property token_type_hint? (`OAuth2RevokeRequestToken_type_hint`) - Optional token type hint declared nullable in OpenAPI.
 @property client_id? (`string`) - Optional client identifier declared nullable in OpenAPI.
 @property client_secret? (`string`) - Optional client secret declared nullable in OpenAPI.*/
export interface OAuth2RevokeRequest {
  /**
   * 
   */
  token: string,
  /**
   * Optional token type hint declared nullable in OpenAPI.
   */
  token_type_hint?: OAuth2RevokeRequestToken_type_hint,
  /**
   * Optional client identifier declared nullable in OpenAPI.
   */
  client_id?: string,
  /**
   * Optional client secret declared nullable in OpenAPI.
   */
  client_secret?: string,
};


/**
 * 
 @property error (`string`) - OAuth2 error code
 @property error_description? (`string`) - Human-readable error description*/
export interface OAuth2ErrorResponse {
  /**
   * OAuth2 error code
   */
  error: string,
  /**
   * Human-readable error description
   */
  error_description?: string,
};



export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     Summary: OAuth2 Token Revocation (RFC 7009)
     Revoke an access token or refresh token.

     This method may return different T based on the response code:
     - 200: void
     */
  oauth2Revoke(
    body: OAuth2RevokeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;
};


export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };
    const  oauth2Revoke = async (
    body: OAuth2RevokeRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
    const url = `${ baseURL }/oauth2/revoke`;
    const params = new URLSearchParams();
    if (body["token"] !== undefined && body["token"] !== null) {
      params.append("token", String(body["token"]));
    }
    if (body["token_type_hint"] !== undefined && body["token_type_hint"] !== null) {
      params.append("token_type_hint", String(body["token_type_hint"]));
    }
    if (body["client_id"] !== undefined && body["client_id"] !== null) {
      params.append("client_id", String(body["client_id"]));
    }
    if (body["client_secret"] !== undefined && body["client_secret"] !== null) {
      params.append("client_secret", String(body["client_secret"]));
    }

    const res = await fetch(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...options?.headers,
      },
      body: params.toString(),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const payload: undefined = undefined;
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;

  };


  return {
    baseURL,
    pushChainFunction,
      oauth2Revoke,
  };
};
