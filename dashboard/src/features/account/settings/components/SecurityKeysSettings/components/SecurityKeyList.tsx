import { Spinner } from '@/components/ui/v3/spinner';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { Fingerprint } from 'lucide-react';
import { memo } from 'react';
import RemoveSecurityKeyButton from './RemoveSecurityKeyButton';

type SecurityKeyProps = {
  id: string;
  nickname?: string;
};

function SecurityKey({ id, nickname }: SecurityKeyProps) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border border-[#EAEDF0] px-2 py-2 dark:border-[#2F363D]">
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
        <InfoAlert>No security keys have been added yet!</InfoAlert>
      )}
      {data?.authUserSecurityKeys.map(({ id, nickname }) => (
        <MemoizedSecurityKey key={id} id={id} nickname={nickname} />
      ))}
    </div>
  );
}

export default SecurityKeyList;
