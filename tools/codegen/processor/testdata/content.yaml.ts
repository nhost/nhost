/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * Error details.
 @property message (`string`) - Human-readable error message.
    *    Example - `"File not found"`*/
export interface ErrorResponseError {
  /**
   * Human-readable error message.
    *    Example - `"File not found"`
   */
  message: string,
};


/**
 * Error information returned by the API.
 @property error? (`ErrorResponseError`) - Error details.*/
export interface ErrorResponse {
  /**
   * Error details.
   */
  error?: ErrorResponseError,
};


/**
 * 
 */
export type SignInProvider = "apple" | "github" | "google" | "linkedin" | "discord" | "spotify" | "twitch" | "gitlab" | "bitbucket" | "workos" | "azuread" | "strava" | "facebook" | "windowslive" | "twitter";

/**
 * Parameters for the signInProvider method.
    @property allowedRoles? (string[]) - Array of allowed roles for the user
  
    @property defaultRole? (string) - Default role for the user
  
    @property displayName? (string) - Display name for the user
  
    @property locale? (string) - A two-characters locale
  
    @property metadata? (Record<string, unknown>) - Additional metadata for the user (JSON encoded string)
  
    @property redirectTo? (string) - URI to redirect to
  
    @property connect? (string) - If set, this means that the user is already authenticated and wants to link their account. This needs to be a valid JWT access token.
  */
export interface SignInProviderParams {
  /**
   * Array of allowed roles for the user
  
   */
  allowedRoles?: string[];
  /**
   * Default role for the user
  
   */
  defaultRole?: string;
  /**
   * Display name for the user
  
   */
  displayName?: string;
  /**
   * A two-characters locale
  
   */
  locale?: string;
  /**
   * Additional metadata for the user (JSON encoded string)
  
   */
  metadata?: Record<string, unknown>;
  /**
   * URI to redirect to
  
   */
  redirectTo?: string;
  /**
   * If set, this means that the user is already authenticated and wants to link their account. This needs to be a valid JWT access token.
  
   */
  connect?: string;
}


export interface Client {
  baseURL: string;
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     Summary: Sign in with an OAuth2 provider
     Initiate OAuth2 authentication flow with a social provider. Redirects the user to the provider's authorization page.

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  signInProviderURL(
    provider: SignInProvider,
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
    provider: SignInProvider,
    params?: SignInProviderParams,
  ): string => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .map(([key, value]) => {
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object'
          ? JSON.stringify(value)
          : (value as string)
        return `${key}=${encodeURIComponent(stringValue)}`
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
