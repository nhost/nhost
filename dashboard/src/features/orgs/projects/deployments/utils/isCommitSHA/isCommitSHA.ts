type CommitSHA = string & { readonly brand: 'CommitSHA' };

export default function isCommitSHA(
  ref: string | null | undefined,
): ref is CommitSHA {
  return /^[\da-f]{40}$/i.test(ref ?? '');
}
