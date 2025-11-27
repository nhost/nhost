import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import DataGridConfigDrawerColumnsTab from './DataGridConfigDrawerColumnsTab/DataGridConfigDrawerColumnsTab';
import { DataGridConfigDrawerFiltersTab } from './DataGridConfigDrawerFiltersTab';
import DataGridConfigDrawerSettingsTab from './DataGridConfigDrawerSettingsTab';
import DataGridConfigDrawerViewsTab from './DataGridConfigDrawerViewsTab';

type Props = {
  tab: string;
  onTabChange: (newTab: string) => void;
};

function DataGridConfigDrawerTabs({ tab, onTabChange }: Props) {
  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="filters">Filters</TabsTrigger>
        <TabsTrigger value="columns">Columns</TabsTrigger>
        <TabsTrigger value="views">Views</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <div className="pt-7">
        {tab === 'filters' && <DataGridConfigDrawerFiltersTab />}
        {tab === 'columns' && <DataGridConfigDrawerColumnsTab />}
        {tab === 'views' && <DataGridConfigDrawerViewsTab />}
        {tab === 'settings' && <DataGridConfigDrawerSettingsTab />}
      </div>
    </Tabs>
  );
}

export default DataGridConfigDrawerTabs;
