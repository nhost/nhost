import AddSecurityKeyButton from './AddSecurityKeyButton';
import SecurityKeyList from './SecurityKeyList';

function SecurityKeysSettings() {
  return (
    <div className="rounded-lg border border-[#EAEDF0] bg-white font-display dark:border-[#2F363D] dark:bg-paper">
      <div className="flex w-full flex-col items-start gap-6 p-4">
        <div className="flex w-full items-center justify-between">
          <h3 className="text-[1.125rem] font-semibold leading-[1.75]">
            Manage your security keys
          </h3>
        </div>
        <div className="flex w-full flex-col gap-4">
          <SecurityKeyList />
        </div>
      </div>
      <div className="flex w-full items-center border-t border-[#EAEDF0] px-4 py-2 dark:border-[#2F363D]">
        <AddSecurityKeyButton />
      </div>
    </div>
  );
}

export default SecurityKeysSettings;
