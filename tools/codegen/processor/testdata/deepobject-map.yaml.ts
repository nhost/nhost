/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";
/**
 * Parameters for the signInProvider method.
    @property redirectTo? (string) - 
    @property upstreamParams? (Record<string, string>) - Extra parameters forwarded verbatim to the upstream OAuth2 provider's authorization URL.
  
    *    Extra key/value parameters forwarded verbatim to the upstream OAuth2 provider.*/
export interface SignInProviderParams {
  /**
   * 
   */
  redirectTo?: string;
  /**
   * Extra parameters forwarded verbatim to the upstream OAuth2 provider's authorization URL.
  
    *    Extra key/value parameters forwarded verbatim to the upstream OAuth2 provider.
   */
  upstreamParams?: Record<string, string>;
}


export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     Summary: Sign in with an OAuth2 provider
     

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  signInProviderURL(
    provider: string,
    params?: SignInProviderParams,
    options?: RequestInit,
  ): string;
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
    const  signInProviderURL = (
    provider: string,
    params?: SignInProviderParams,
  ): string => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        if (key === "upstreamParams") {
          // deepObject with explode: true - upstreamParams[prop]=value
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return Object.entries(value)
              .map(([k, v]) => `upstreamParams[${encodeURIComponent(k)}]=${encodeURIComponent(String(v))}`)
          }
          return []
        }
        // Default handling (scalars or explode: false)
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value)
        return [`${key}=${encodeURIComponent(stringValue)}`]
      })
      .join('&')

    const url =
     encodedParameters
        ? `${ baseURL }/signin/provider/${provider}?${encodedParameters}`
        : `${ baseURL }/signin/provider/${provider}`;
    return url;
  };


  return {
    baseURL,
    pushChainFunction,
      signInProviderURL,
  };
};
