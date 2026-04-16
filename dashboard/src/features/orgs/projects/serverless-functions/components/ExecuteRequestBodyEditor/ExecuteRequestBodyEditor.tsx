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

  const isJson = contentType.includes('json');
  const isXml = contentType.includes('xml');

  return (
    <Textarea
      {...register('body')}
      placeholder={
        isJson
          ? '{\n  "key": "value"\n}'
          : isXml
            ? '<?xml version="1.0"?>\n<root />'
            : 'Request body...'
      }
      className="min-h-32 font-mono text-sm"
    />
  );
}
