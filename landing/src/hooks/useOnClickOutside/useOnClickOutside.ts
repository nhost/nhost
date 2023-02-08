import { MutableRefObject, useEffect } from 'react'

export default function useOnClickOutside<T extends HTMLElement | null>(
  ref: MutableRefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  useEffect(() => {
    function listener(event: MouseEvent | TouchEvent) {
      if (
        !ref.current ||
        !event.target ||
        ref.current.contains(event.target as Node)
      ) {
        return
      }

      handler(event)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}
