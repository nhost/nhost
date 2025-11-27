// import {
//   Sheet,
//   SheetContent,
//   SheetDescription,
//   SheetHeader,
//   SheetTitle,
// } from '@/components/ui/v3/sheet';
import DataGridCustomizerTrigger from '@/features/orgs/projects/common/components/DataGridCustomizerControls/DataGridCustomizerTrigger';
import { PopoverTrigger } from '@radix-ui/react-popover';
import { Popover, PopoverContent } from 'components/ui/v3/popover';
import { useState } from 'react';
import DataGridFilterTrigger from './DataConfigDrawerTabs/DataGridConfigDrawerFiltersTab/DataGridFilter/DataGridFilterTrigger';
import DataGridConfigDrawerTabs from './DataConfigDrawerTabs/DataGridConfigDrawerTabs';

// type DataGridConfigDrawerTab = 'filters' | 'columns' | 'table' | 'views'

function DataGridConfigDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('filters');

  function handleOpen(newActiveTab: string) {
    if (!open) {
      setOpen(true);
      setTab(newActiveTab);
    } else if (open && newActiveTab !== tab) {
      setTab(newActiveTab);
    } else {
      setOpen((o) => !o);
    }
  }

  return (
    <Popover open={open}>
      <PopoverTrigger>
        <DataGridFilterTrigger onClick={() => handleOpen('filters')} />
        <DataGridCustomizerTrigger onClick={() => handleOpen('columns')} />
      </PopoverTrigger>
      <PopoverContent
        className="box flex flex-col gap-6 p-4 will-change-auto md:w-[40rem] md:max-w-[40rem]"
        align="end"
      >
        <h2 className="text-lg">Data Table Settings</h2>
        <DataGridConfigDrawerTabs tab={tab} onTabChange={setTab} />
      </PopoverContent>
    </Popover>
  );
}

export default DataGridConfigDrawer;
