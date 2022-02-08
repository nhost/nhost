import { ActionFunctionMap, StatesConfig } from 'xstate'
import { NhostContext } from '../context'
import { changeEmailActions, changeEmailConfig } from './change-email'
import { changePasswordActions, changePasswordConfig } from './change-password'

export const userConfig: StatesConfig<NhostContext, any, any> = {
  ...changeEmailConfig,
  ...changePasswordConfig
}

export const userActions: ActionFunctionMap<NhostContext, any, any> = {
  ...changeEmailActions,
  ...changePasswordActions
}

export const userGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {}
