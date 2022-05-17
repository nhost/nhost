import {
  BaseActionObject,
  EventObject,
  ResolveTypegenMeta,
  ServiceMap,
  State,
  TypegenConstraint
} from 'xstate'
import {
  AuthContext,
  AuthEvents,
  ChangeEmailContext,
  ChangeEmailEvents,
  ChangePasswordContext,
  ChangePasswordEvents,
  EnableMfaContext,
  EnableMfaEvents,
  ResetPasswordContext,
  ResetPasswordEvents,
  SendVerificationEmailContext,
  SendVerificationEmailEvents
} from '../../src/machines'

export type GeneralState<
  Context,
  Events extends EventObject,
  Typegen extends TypegenConstraint
> = State<
  Context,
  Events,
  any,
  {
    value: any
    context: Context
  },
  ResolveTypegenMeta<Typegen, Events, BaseActionObject, ServiceMap>
>

export type GeneralAuthState<Typegen extends TypegenConstraint> = GeneralState<
  AuthContext,
  AuthEvents,
  Typegen
>

export type GeneralResetPasswordState<Typegen extends TypegenConstraint> = GeneralState<
  ResetPasswordContext,
  ResetPasswordEvents,
  Typegen
>

export type GeneralSendVerificationEmailState<Typegen extends TypegenConstraint> = GeneralState<
  SendVerificationEmailContext,
  SendVerificationEmailEvents,
  Typegen
>

export type GeneralEnableMfaState<Typegen extends TypegenConstraint> = GeneralState<
  EnableMfaContext,
  EnableMfaEvents,
  Typegen
>

export type GeneralChangeEmailState<Typegen extends TypegenConstraint> = GeneralState<
  ChangeEmailContext,
  ChangeEmailEvents,
  Typegen
>

export type GeneralChangePasswordState<Typegen extends TypegenConstraint> = GeneralState<
  ChangePasswordContext,
  ChangePasswordEvents,
  Typegen
>
