/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * 
 @property value? (`string`) - */
export interface Arc {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Client {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Deserialize {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Error {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface ErrorType {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface HashMap {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Response {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Self {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface Serialize {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface SessionStorage {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface SetHeaders {
  /**
   * 
   */
  value?: string,
};


/**
 * 
 @property value? (`string`) - */
export interface SetRole {
  /**
   * 
   */
  value?: string,
};



export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;};


export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };

  return {
    baseURL,
    pushChainFunction,
  };
};
