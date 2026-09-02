/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * 
 @property term (`string`) - */
export interface Filter {
  /**
   * 
   */
  term: string,
};

/**
 * Parameters for the getItems method.
    @property filter (Filter) - */
export interface GetItemsParams {
  /**
   * 
   */
  filter: Filter;
}
/**
 * Parameters for the getOptionalItems method.
    @property filter? (Filter) - */
export interface GetOptionalItemsParams {
  /**
   * 
   */
  filter?: Filter;
}


export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     

     This method may return different T based on the response code:
     - 200: void
     */
  getItems(
    params?: GetItemsParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;

    /**
     

     This method may return different T based on the response code:
     - 200: void
     */
  getOptionalItems(
    params?: GetOptionalItemsParams,
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
    const  getItems = async (
    params?: GetItemsParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        if (key === "filter") {
          // Object with explode: true - each property as separate parameter
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return Object.entries(value)
              .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          }
          return [`${key}=${encodeURIComponent(String(value))}`]
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
        ? `${ baseURL }/items?${encodedParameters}`
        : `${ baseURL }/items`;
    const res = await fetch(url, {
      ...options,
      method: "GET",
      headers: {
        ...options?.headers,
      },
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

    const  getOptionalItems = async (
    params?: GetOptionalItemsParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        if (key === "filter") {
          // Object with explode: true - each property as separate parameter
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return Object.entries(value)
              .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          }
          return [`${key}=${encodeURIComponent(String(value))}`]
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
        ? `${ baseURL }/optional-items?${encodedParameters}`
        : `${ baseURL }/optional-items`;
    const res = await fetch(url, {
      ...options,
      method: "GET",
      headers: {
        ...options?.headers,
      },
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
      getItems,
      getOptionalItems,
  };
};
