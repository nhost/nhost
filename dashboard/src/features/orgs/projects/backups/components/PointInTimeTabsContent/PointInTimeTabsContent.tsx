import { Spinner } from '@/components/ui/v3/spinner';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import PiTRNotEnabled from './PiTRNotEnabled';
import PointInTimeRecovery from './PointInTimeRecovery';

function PointInTimeTabsContent() {
  const { isPiTREnabled, loading } = useIsPiTREnabled();
  const content = isPiTREnabled ? <PointInTimeRecovery /> : <PiTRNotEnabled />;
  return (
    <TabsContent value="pointInTime">
      {loading ? <Spinner /> : content}
    </TabsContent>
  );
}

export default PointInTimeTabsContent;
