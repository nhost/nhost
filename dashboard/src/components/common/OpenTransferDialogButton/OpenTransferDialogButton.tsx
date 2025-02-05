import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';

interface Props {
  buttonText?: string;
  onClick?: () => void;
}

function OpenTransferDialogButton({ buttonText, onClick }: Props) {
  const text = buttonText ?? 'Transfer Project';
  const isOwner = useIsCurrentUserOwner();
  const { openAlertDialog } = useDialog();
  const handleClick = () => {
    if (isOwner) {
      onClick();
    } else {
      openAlertDialog({
        title: "You can't migrate this project",
        payload: (
          <Text variant="subtitle1" component="span">
            Ask an owner of this organization to migrate the project.
          </Text>
        ),
        props: {
          secondaryButtonText: 'I understand',
          hidePrimaryAction: true,
        },
      });
    }
  };
  return (
    <Button className="max-w-xs lg:w-auto" onClick={handleClick}>
      {text}
    </Button>
  );
}

export default OpenTransferDialogButton;
