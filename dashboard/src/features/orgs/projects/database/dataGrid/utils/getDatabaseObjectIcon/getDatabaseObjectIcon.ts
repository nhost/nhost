import {
  BetweenHorizontalEnd,
  List,
  ScanEye,
  Table2,
  View,
} from 'lucide-react';
import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function getDatabaseObjectIcon(
  objectType: DatabaseObjectType,
  isEnum: boolean,
) {
  if (objectType === 'VIEW') {
    return ScanEye;
  }
  if (objectType === 'MATERIALIZED VIEW') {
    return View;
  }
  if (objectType === 'FOREIGN TABLE') {
    return BetweenHorizontalEnd;
  }
  if (isEnum) {
    return List;
  }
  return Table2;
}
