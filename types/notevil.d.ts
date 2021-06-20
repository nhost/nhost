/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO crappy: default function is not exported correctly. For instance we cannot `import notevil from 'notevil'` then use `notevil.Function`'
declare module 'notevil' {
  export function Function(...params: string[]): Function
  export function FunctionFactory(parentContext: { [key: string]: any }): Function
  export default function (code: string, context?: { [key: string]: any }): any
}
