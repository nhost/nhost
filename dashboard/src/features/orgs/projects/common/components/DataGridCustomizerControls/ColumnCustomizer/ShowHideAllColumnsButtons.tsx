import { Button } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';

type ShowHideAllColumnsToggleProps = {
  onShowAll: () => void;
  onHideAll: () => void;
  onReset: () => void;
};

function ShowHideAllColumnsButtons({
  onShowAll,
  onHideAll,
  onReset,
}: ShowHideAllColumnsToggleProps) {
  return (
    <ButtonGroup className="w-full">
      <Button variant="outline" className="flex-1" onClick={onShowAll}>
        Show all columns
      </Button>
      <Button variant="outline" className="flex-1" onClick={onHideAll}>
        Hide all columns
      </Button>
      <Button variant="outline" className="flex-1" onClick={onReset}>
        Reset
      </Button>
    </ButtonGroup>
  );
}

export default ShowHideAllColumnsButtons;
