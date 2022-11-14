/**
 * Returns `true` if all features of the dashboard should be enabled.
 */
export default function useIsPlatform() {
  return process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true';
}
