import { useRouter } from 'next/router';
import ViewDefinitionView from '@/features/orgs/projects/database/dataGrid/components/ViewDefinitionView';

export interface EditViewFormProps {
  /**
   * Schema where the view is located.
   */
  schema: string;
  /**
   * Name of the view to be edited.
   */
  tableName: string;
  /**
   * Function to be called when the form is submitted.
   * Optional since views don't have a traditional form submission.
   */
  onSubmit?: (tableName: string) => Promise<void>;
}

export default function EditViewForm({ schema, tableName }: EditViewFormProps) {
  const router = useRouter();
  const {
    query: { dataSourceSlug },
  } = router;

  return (
    <ViewDefinitionView
      schema={schema}
      table={tableName}
      dataSource={(dataSourceSlug as string) || 'default'}
    />
  );
}
