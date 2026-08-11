import type { ColumnFormReference } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export function createColumnFormReference(): ColumnFormReference {
  return `column-${crypto.randomUUID()}`;
}

export function createConstraintFormId(): string {
  return `unique-${crypto.randomUUID()}`;
}
