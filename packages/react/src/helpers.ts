import React from 'react'

type ResultBox<T> = { v: T }

/**
 * Gracefully poached from {@link https://github.com/Andarist/use-constant}, thanks to the original author
 * @param fn
 * @returns
 */
export default function useConstant<T>(fn: () => T): T {
  const ref = React.useRef<ResultBox<T>>()

  if (!ref.current) {
    ref.current = { v: fn() }
  }

  return ref.current.v
}
