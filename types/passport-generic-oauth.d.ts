/* eslint-disable @typescript-eslint/class-name-casing */
/* eslint-disable @typescript-eslint/no-explicit-any */
// ! This module declaration is incomplete and is only meant to work with HBP !
declare module 'passport-generic-oauth' {
  import passport = require('passport')
  import oauth2 = require('passport-oauth2')
  import express = require('express')
  type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
  type Merge<M, N> = Omit<M, Extract<keyof M, keyof N>> & N

  export type Profile = Merge<
    passport.Profile,
    {
      email: string
      name?: {
        firstName: string
        lastName: string
      }
    }
  >

  export interface StrategyOption extends passport.AuthenticateOptions {
    clientID: string
    clientSecret: string
    callbackURL?: string
    passReqToCallbacks: boolean

    scope?: string[]
    // ? Probably incomplete
  }

  export type OAuth2StrategyOptionsWithoutRequiredURLs = Pick<
    oauth2._StrategyOptionsBase,
    Exclude<keyof oauth2._StrategyOptionsBase, 'authorizationURL' | 'tokenURL'>
  >

  export interface _StrategyOptionsBase extends OAuth2StrategyOptionsWithoutRequiredURLs {
    clientID: string
    clientSecret: string
    callbackURL?: string
    passReqToCallbacks: boolean

    scope?: string[]
    // ? Probably incomplete
  }

  export interface StrategyOptions extends _StrategyOptionsBase {
    passReqToCallback?: false
  }
  export interface StrategyOptionsWithRequest extends _StrategyOptionsBase {
    passReqToCallback: true
  }

  export class Strategy extends oauth2.Strategy {
    constructor(options: StrategyOptions, verify: oauth2.VerifyFunction)
    constructor(options: StrategyOptionsWithRequest, verify: oauth2.VerifyFunctionWithRequest)
    userProfile(accessToken: string, done: (err?: Error | null, profile?: any) => void): void

    name: string
    authenticate(req: express.Request, options?: passport.AuthenticateOptions): void
  }
}
