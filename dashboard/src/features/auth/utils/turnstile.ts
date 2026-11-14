export function isTurnstileEnabled(): boolean {
  return process.env.NODE_ENV !== 'development';
}
