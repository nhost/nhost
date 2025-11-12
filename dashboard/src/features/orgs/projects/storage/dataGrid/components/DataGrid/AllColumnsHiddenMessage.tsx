import { Button } from '@/components/ui/v3/button';
import { useDataGridCustomizerOpenStateContext } from '@/features/orgs/projects/common/components/DataGridCustomizerControls/DataGridCustomizerOpenStateProvider';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';

function Description() {
  const { setOpen } = useDataGridCustomizerOpenStateContext();

  function handleOnClick() {
    setOpen(true);
  }

  return (
    <>
      <Button variant="link" onClick={handleOnClick} className="pr-2">
        Open Customize Table View
      </Button>
      to choose which columns to display.
    </>
  );
}

function AllColumnsHiddenMessage() {
  return (
    <DataBrowserEmptyState
      title="All columns are hidden"
      description={<Description />}
    />
  );
}

export default AllColumnsHiddenMessage;
