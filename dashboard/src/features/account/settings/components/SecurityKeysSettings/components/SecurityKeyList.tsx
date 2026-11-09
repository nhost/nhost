import { Fingerprint } from 'lucide-react';
import { memo } from 'react';
import { SettingsCardContent } from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import RemoveSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/RemoveSecurityKeyButton';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';

type SecurityKeyProps = {
  id: string;
  nickname?: string | null;
};

function SecurityKey({ id, nickname }: SecurityKeyProps) {
  return (
    <TableRow>
      <TableCell className="pl-6">
        <span className="flex min-w-0 items-center gap-3">
          <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{nickname || id}</span>
        </span>
      </TableCell>
      <TableCell className="pr-6 text-right">
        <RemoveSecurityKeyButton id={id} />
      </TableCell>
    </TableRow>
  );
}

const MemoizedSecurityKey = memo(SecurityKey);

function SecurityKeyList() {
  const { data, loading } = useGetSecurityKeys();

  if (loading) {
    return (
      <SettingsCardContent className="mt-6">
        <Spinner />
      </SettingsCardContent>
    );
  }

  const securityKeys = data?.authUserSecurityKeys ?? [];

  if (securityKeys.length === 0) {
    return null;
  }

  return (
    <SettingsCardContent className="mt-6 px-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Name</TableHead>
            <TableHead className="w-12 pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {securityKeys.map(({ id, nickname }) => (
            <MemoizedSecurityKey key={id} id={id} nickname={nickname} />
          ))}
        </TableBody>
      </Table>
    </SettingsCardContent>
  );
}

export default SecurityKeyList;
