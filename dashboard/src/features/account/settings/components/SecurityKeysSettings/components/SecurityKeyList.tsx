import { Fingerprint } from 'lucide-react';
import { memo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Spinner } from '@/components/ui/v3/spinner';
import RemoveSecurityKeyButton from '@/features/account/settings/components/SecurityKeysSettings/components/RemoveSecurityKeyButton';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';

type SecurityKeyProps = {
  id: string;
  nickname?: string | null;
};

function SecurityKey({ id, nickname }: SecurityKeyProps) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border border-border px-2 py-2">
      <div className="flex justify-start gap-3">
        <Fingerprint />
        <span>{nickname || id}</span>
      </div>
      <RemoveSecurityKeyButton id={id} />
    </div>
  );
}

const MemoizedSecurityKey = memo(SecurityKey);

function SecurityKeyList() {
  const { data, loading } = useGetSecurityKeys();

  return (
    <div>
      {loading && <Spinner />}
      {!loading && data?.authUserSecurityKeys.length === 0 && (
        <Alert>
          <AlertDescription>
            No security keys have been added yet!
          </AlertDescription>
        </Alert>
      )}
      {data?.authUserSecurityKeys.map(({ id, nickname }) => (
        <MemoizedSecurityKey key={id} id={id} nickname={nickname} />
      ))}
    </div>
  );
}

export default SecurityKeyList;
