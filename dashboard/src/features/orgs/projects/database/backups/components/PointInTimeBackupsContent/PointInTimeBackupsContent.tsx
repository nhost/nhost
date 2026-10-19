import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import PiTRNotEnabled from './PiTRNotEnabled';
import PointInTimeRecovery from './PointInTimeRecovery';

function PointInTimeBackupsContent() {
  const { isPiTREnabled, loading } = useIsPiTREnabled();
  const content = isPiTREnabled ? <PointInTimeRecovery /> : <PiTRNotEnabled />;
  return loading ? <Spinner /> : content;
}

export default PointInTimeBackupsContent;
