import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

interface PlaygroundHeaderProps {
  /**
   * Function to be called when the user or role changes.
   */
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
}

/** "Request as": the user and role the playground sends requests as. */
export default function PlaygroundHeader({
  onSelectionChange,
}: PlaygroundHeaderProps) {
  return (
    <header className="shrink-0 px-4 pt-4 pb-4">
      <UserAndRoleSelect onSelectionChange={onSelectionChange} />
    </header>
  );
}
