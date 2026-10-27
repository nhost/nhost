export default function isCommitSHA(
  ref: string | null | undefined,
): ref is string {
  return /^[\da-f]{40}$/i.test(ref ?? '');
}
