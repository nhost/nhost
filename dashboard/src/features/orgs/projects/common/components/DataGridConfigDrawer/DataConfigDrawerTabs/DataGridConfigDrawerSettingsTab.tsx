import { TabsContent } from '@/components/ui/v3/tabs';
import RowDensityCustomizer from '@/features/orgs/projects/common/components/DataGridCustomizerControls/RowDensityCustomizer';

function DataGridConfigDrawerSettingsTab() {
  return (
    <TabsContent value="settings">
      <RowDensityCustomizer />
    </TabsContent>
  );
}

export default DataGridConfigDrawerSettingsTab;
