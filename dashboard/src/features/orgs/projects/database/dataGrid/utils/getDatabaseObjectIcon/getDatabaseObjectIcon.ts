import type { LucideIcon } from 'lucide-react';
import {
  BetweenHorizontalEnd,
  List,
  ScanEye,
  SquareFunction,
  Table2,
  View,
} from 'lucide-react';
import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const iconByType: Record<DatabaseObjectType, LucideIcon> = {
  FUNCTION: SquareFunction,
  VIEW: ScanEye,
  'ORDINARY TABLE': Table2,
  'MATERIALIZED VIEW': View,
  'FOREIGN TABLE': BetweenHorizontalEnd,
};

export default function getDatabaseObjectIcon(
  objectType: DatabaseObjectType,
  isEnum: boolean,
) {
  if (isEnum && objectType === 'ORDINARY TABLE') {
    return List;
  }
  return iconByType[objectType];
}
