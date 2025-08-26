export const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.location !== 'undefined'
