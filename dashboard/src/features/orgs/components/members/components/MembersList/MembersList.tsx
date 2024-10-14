import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function MembersList() {
  const { org } = useCurrentOrg();

  const members = org?.members ?? [];

  return <div>Members List {members.length}</div>;
}
