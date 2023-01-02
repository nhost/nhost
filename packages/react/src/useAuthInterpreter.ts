import { AuthMachine } from '@nhost/nhost-js'
import { useContext } from 'react'
import { InterpreterFrom } from 'xstate'
import { NhostReactContext } from './provider'

/** @internal */
export const useAuthInterpreter = (): InterpreterFrom<AuthMachine> => {
  const nhost = useContext(NhostReactContext)
  const interpreter = nhost.auth?.client.interpreter
  if (!interpreter)
    throw Error('Could not find the Nhost auth client. Did you wrap your app in <NhostProvider />?')
  return interpreter
}
