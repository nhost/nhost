import { BaseActionObject, ResolveTypegenMeta, ServiceMap, State, TypegenConstraint } from 'xstate'
import { AuthContext, AuthEvents } from '../../src/machines'

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
