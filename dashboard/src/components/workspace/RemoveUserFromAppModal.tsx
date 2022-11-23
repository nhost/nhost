import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';

export default function RemoveUserFromAppModal({ onClick, close }: any) {
  return (
    <div className="grid w-miniModal grid-flow-row gap-4 p-6 text-left">
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete User Account
        </Text>

        <Text>
          This user can no longer sign in. A new account can be created with
          this email later.
        </Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Button color="error" onClick={onClick}>
          Delete Account
        </Button>

        <Button variant="outlined" color="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
