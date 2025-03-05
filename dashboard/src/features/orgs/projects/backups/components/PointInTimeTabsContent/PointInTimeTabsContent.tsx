import { Spinner } from '@/components/ui/v3/spinner';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useIsPITREnabled } from '@/features/orgs/hooks/useIsPITREnabled';
import PITRNotEnabled from './PITRNotEnabled';

function PointInTimeTabsContent() {
  const { isPITREnabled, loading } = useIsPITREnabled();
  const content = isPITREnabled ? <h1>PITR enabled</h1> : <PITRNotEnabled />;
  return (
    <TabsContent value="pointInTime">
      {loading ? <Spinner /> : content}
    </TabsContent>
  );
}

export default PointInTimeTabsContent;
