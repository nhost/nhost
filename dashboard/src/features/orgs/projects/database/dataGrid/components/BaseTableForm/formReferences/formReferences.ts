import { v4 as uuidv4 } from 'uuid';
import type { ColumnFormReference } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export function createColumnFormReference(): ColumnFormReference {
  return `column-${uuidv4()}`;
}

export function createConstraintFormId(): string {
  return `unique-${uuidv4()}`;
}
