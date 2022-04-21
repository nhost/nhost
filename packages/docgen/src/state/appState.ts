import { proxy } from 'valtio/vanilla'

export const appState = proxy({ verbose: false })

export default appState
