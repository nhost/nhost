import { useRouter } from 'next/router';
import ViewDefinitionView from '@/features/orgs/projects/database/dataGrid/components/ViewDefinitionView';
import type {
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface EditViewFormProps {
  /**
   * Schema where the view is located.
   */
  schema: string;
  /**
   * View to be edited.
   */
  table: NormalizedQueryDataRow;
  /**
   * Function to be called when the form is submitted.
   * Optional since views don't have a traditional form submission.
   */
  onSubmit?: (tableName: string) => Promise<void>;
}

export default function EditViewForm({
  schema,
  table,
}: EditViewFormProps) {
  const router = useRouter();
  const {
    query: { dataSourceSlug },
  } = router;

  return (
    <ViewDefinitionView
      schema={schema}
      table={table.table_name}
      dataSource={(dataSourceSlug as string) || 'default'}
    />
  );
}
