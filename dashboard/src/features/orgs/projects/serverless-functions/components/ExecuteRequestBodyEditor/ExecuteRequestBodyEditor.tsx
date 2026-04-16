import { useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/v3/textarea';
import { KeyValueEditor } from '@/features/orgs/projects/serverless-functions/components/KeyValueEditor';
import { MultipartEditor } from '@/features/orgs/projects/serverless-functions/components/MultipartEditor';
import type { ExecuteFormValues } from '@/features/orgs/projects/serverless-functions/types';

export default function ExecuteRequestBodyEditor() {
  const { register, watch } = useFormContext<ExecuteFormValues>();
  const contentType = watch('contentType');

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return (
      <KeyValueEditor
        name="formFields"
        keyPlaceholder="Field name"
        valuePlaceholder="Field value"
      />
    );
  }

  if (contentType.includes('multipart/form-data')) {
    return <MultipartEditor name="multipartFields" />;
  }

  let placeholder = 'Request body...';
  if (contentType.includes('json')) {
    placeholder = '{\n  "key": "value"\n}';
  } else if (contentType.includes('xml')) {
    placeholder = '<?xml version="1.0"?>\n<root />';
  }

  return (
    <Textarea
      {...register('body')}
      placeholder={placeholder}
      className="min-h-32 font-mono text-sm"
    />
  );
}
