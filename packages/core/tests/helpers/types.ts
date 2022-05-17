import { BaseActionObject, ResolveTypegenMeta, ServiceMap, State, TypegenConstraint } from 'xstate'
import {
  AuthContext,
  AuthEvents,
  ResetPasswordContext,
  ResetPasswordEvents
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
