import { useContext } from 'react'
import { InterpreterFrom } from 'xstate'

import { AuthMachine } from '@nhost/hasura-auth-js'

import { NhostReactContext } from './provider'

/** @internal */
export const useAuthInterpreter = (): InterpreterFrom<AuthMachine> => {
  const nhost = useContext(NhostReactContext)
  const interpreter = nhost.auth?.client.interpreter
  if (!interpreter) throw Error('No interpreter')
  return interpreter
}
