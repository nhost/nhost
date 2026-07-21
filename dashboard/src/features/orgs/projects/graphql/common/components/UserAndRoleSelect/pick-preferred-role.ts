export default function pickPreferredRole(
  userId: string,
  roles: string[],
): string | undefined {
  if (userId !== 'admin' && roles.includes('user')) {
    return 'user';
  }

  return roles[0];
}
