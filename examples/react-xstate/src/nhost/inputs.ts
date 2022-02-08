import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { MIN_PASSWORD_LENGTH } from './constants'
import { NhostContext } from './context'

export const inputsConfig: StatesConfig<NhostContext, any, any> = {}

export const inputsActions: ActionFunctionMap<NhostContext, any, any> = {
  // * Form
  clearForm: assign((ctx) => {
    ctx.email = undefined
    ctx.password = undefined
  }),
  saveEmail: assign((ctx, e) => {
    ctx.email = e.email
  }),
  savePassword: assign((ctx, e) => {
    ctx.password = e.password
  })
}

export const inputsGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {
  // * Event guards
  hasUser: (_, e) => !!e.data.session,
  invalidEmail: (_, e) =>
    !String(e.email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      ),
  invalidPassword: (_, e) => !e.password || e.password.length <= MIN_PASSWORD_LENGTH
}
