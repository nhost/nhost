import { BaseActionObject, ResolveTypegenMeta, ServiceMap, State, TypegenConstraint } from 'xstate'
import {
  AuthContext,
  AuthEvents,
  EnableMfaContext,
  EnableMfaEvents,
  ResetPasswordContext,
  ResetPasswordEvents,
  SendVerificationEmailContext,
  SendVerificationEmailEvents
} from '../../src/machines'

export type GeneralAuthState<Typegen extends TypegenConstraint> = State<
  AuthContext,
  AuthEvents,
  any,
  {
    value: any
    context: AuthContext
  },
  ResolveTypegenMeta<Typegen, AuthEvents, BaseActionObject, ServiceMap>
>

export type GeneralResetPasswordState<Typegen extends TypegenConstraint> = State<
  ResetPasswordContext,
  ResetPasswordEvents,
  any,
  {
    value: any
    context: ResetPasswordContext
  },
  ResolveTypegenMeta<Typegen, ResetPasswordEvents, BaseActionObject, ServiceMap>
>

export type GeneralSendVerificationEmailState<Typegen extends TypegenConstraint> = State<
  SendVerificationEmailContext,
  SendVerificationEmailEvents,
  any,
  {
    value: any
    context: SendVerificationEmailContext
  },
  ResolveTypegenMeta<Typegen, SendVerificationEmailEvents, BaseActionObject, ServiceMap>
>

export type GeneralEnableMfaState<Typegen extends TypegenConstraint> = State<
  EnableMfaContext,
  EnableMfaEvents,
  any,
  {
    value: any
    context: EnableMfaContext
  },
  ResolveTypegenMeta<Typegen, EnableMfaEvents, BaseActionObject, ServiceMap>
>
