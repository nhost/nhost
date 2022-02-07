import { createNhostMachine, NhostMachine, NhostMachineOptions } from './machine'

type Nhost = {
  machine: NhostMachine
  backendUrl: string
}
export type { NhostMachine }

export const initNhost = (options: NhostMachineOptions): Nhost => {
  return {
    backendUrl: options.backendUrl,
    machine: createNhostMachine(options)
  }
}
