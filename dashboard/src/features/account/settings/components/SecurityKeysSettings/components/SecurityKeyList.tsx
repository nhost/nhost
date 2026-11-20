import { Fingerprint } from 'lucide-react';
import { memo } from 'react';
import { SettingsCardContent } from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import RemoveSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/RemoveSecurityKeyButton';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';

type SecurityKeyProps = {
  id: string;
  nickname?: string | null;
};

function SecurityKey({ id, nickname }: SecurityKeyProps) {
  return (
    <TableRow className="group">
      <TableCell>
        <span className="flex min-w-0 items-center gap-3">
          <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{nickname || id}</span>
        </span>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex justify-end">
          <RemoveSecurityKeyButton id={id} />
        </div>
      </TableCell>
    </TableRow>
  );
}

const MemoizedSecurityKey = memo(SecurityKey);

function SecurityKeyList() {
  const { data, loading } = useGetSecurityKeys();

  if (loading) {
    return (
      <SettingsCardContent className="mt-2">
        <Spinner />
      </SettingsCardContent>
    );
  }

  const securityKeys = data?.authUserSecurityKeys ?? [];

  if (securityKeys.length === 0) {
    return null;
  }

  return (
    // Same box as the environment variables and secrets lists.
    <SettingsCardContent className="mt-2">
      <VariableGroup>
        {securityKeys.map(({ id, nickname }) => (
          <MemoizedSecurityKey key={id} id={id} nickname={nickname} />
        ))}
      </VariableGroup>
    </SettingsCardContent>
  );
}

export default SecurityKeyList;
