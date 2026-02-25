import { List, Table2, View } from 'lucide-react';

export default function getDatabaseObjectIcon(
  objectType: string,
  isEnum: boolean,
) {
  if (objectType === 'VIEW' || objectType === 'MATERIALIZED VIEW') {
    return View;
  }
  if (isEnum) {
    return List;
  }
  return Table2;
}
