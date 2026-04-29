import { Loader2, Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { TruncatedText } from '@/features/orgs/projects/common/components/TruncatedText';
import { ContentTypeCombobox } from '@/features/orgs/projects/serverless-functions/components/ContentTypeCombobox';
import { ExecuteRequestBodyEditor } from '@/features/orgs/projects/serverless-functions/components/ExecuteRequestBodyEditor';
import { KeyValueEditor } from '@/features/orgs/projects/serverless-functions/components/KeyValueEditor';
import { ResponseArea } from '@/features/orgs/projects/serverless-functions/components/ResponseArea';
import {
  type ExecuteFormValues,
  HTTP_METHODS,
  type HttpMethod,
  type ResponseState,
} from '@/features/orgs/projects/serverless-functions/types';
import { buildServerlessFunctionRequestBody } from '@/features/orgs/projects/serverless-functions/utils/buildServerlessFunctionRequestBody';
import { buildServerlessFunctionRequestHeaders } from '@/features/orgs/projects/serverless-functions/utils/buildServerlessFunctionRequestHeaders';
import { buildServerlessFunctionRequestUrl } from '@/features/orgs/projects/serverless-functions/utils/buildServerlessFunctionRequestUrl';
import { cn } from '@/lib/utils';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600 dark:text-green-400',
  POST: 'text-blue-600 dark:text-blue-400',
  PUT: 'text-orange-600 dark:text-orange-400',
  PATCH: 'text-pink-600 dark:text-pink-400',
  DELETE: 'text-red-600 dark:text-red-400',
  OPTIONS: 'text-purple-600 dark:text-purple-400',
  HEAD: 'text-teal-600 dark:text-teal-400',
};

export interface ExecuteTabProps {
  endpointUrl: string;
}

export default function ExecuteTab({ endpointUrl }: ExecuteTabProps) {
  const form = useForm<ExecuteFormValues>({
    defaultValues: {
      method: 'GET',
      contentType: 'application/json',
      headers: [],
      params: [],
      body: '',
      formFields: [{ key: '', value: '' }],
      multipartFields: [{ key: '', value: '', file: null }],
    },
  });

  const { register, watch, setValue, handleSubmit: handleFormSubmit } = form;

  const [requestTab, setRequestTab] = useState('headers');
  const [response, setResponse] = useState<ResponseState>({ status: 'idle' });

  const method = watch('method');
  const contentType = watch('contentType');
  const isFormEncoded = contentType.includes(
    'application/x-www-form-urlencoded',
  );
  const isMultipart = contentType.includes('multipart/form-data');
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const handleSubmit = handleFormSubmit(async (values) => {
    setResponse({ status: 'loading' });

    const methodHasBody = values.method !== 'GET' && values.method !== 'HEAD';
    const allHeaders =
      methodHasBody && values.contentType
        ? [
            { key: 'Content-Type', value: values.contentType },
            ...values.headers,
          ]
        : values.headers;

    const fullUrl = buildServerlessFunctionRequestUrl(
      endpointUrl,
      values.params,
    );
    const headersObj = buildServerlessFunctionRequestHeaders(
      allHeaders,
      isMultipart,
    );
    const requestBody = buildServerlessFunctionRequestBody(values.method, {
      isMultipart,
      isFormEncoded,
      body: values.body,
      formFields: values.formFields,
      multipartFields: values.multipartFields,
    });

    const start = performance.now();
    try {
      const res = await fetch(fullUrl, {
        method: values.method,
        headers: headersObj,
        body: requestBody,
      });
      const duration = Math.round(performance.now() - start);
      const responseBody = await res.text();

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      setResponse({
        status: res.ok ? 'success' : 'error',
        statusCode: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        duration,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setResponse({
        status: 'error',
        statusCode: 0,
        statusText: err instanceof Error ? err.message : 'Network Error',
        body: err instanceof Error ? err.message : 'Failed to send request',
        duration,
      });
    }
  });

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex items-center justify-between gap-2">
              <Select
                value={method}
                onValueChange={(newMethod) =>
                  setValue('method', newMethod as HttpMethod)
                }
              >
                <SelectTrigger
                  className={cn(
                    'h-10 w-24 font-mono font-semibold text-sm',
                    METHOD_COLORS[method],
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((httpMethod) => (
                    <SelectItem
                      key={httpMethod}
                      value={httpMethod}
                      className={cn(
                        'font-mono font-semibold',
                        METHOD_COLORS[httpMethod],
                      )}
                    >
                      {httpMethod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="submit"
                disabled={response.status === 'loading'}
                className="h-10 gap-2 lg:hidden"
              >
                {response.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
              <TruncatedText text={endpointUrl} tailLength={12} />
              <CopyToClipboardButton
                textToCopy={endpointUrl}
                title="Copy endpoint URL"
                className="ml-auto shrink-0"
              />
            </div>

            <Button
              type="submit"
              disabled={response.status === 'loading'}
              className="hidden h-10 gap-2 lg:inline-flex"
            >
              {response.status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>

          <Tabs
            value={requestTab}
            onValueChange={setRequestTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="h-8 shrink-0 self-start">
              <TabsTrigger value="headers" className="text-xs">
                Headers
              </TabsTrigger>
              <TabsTrigger value="params" className="text-xs">
                Params
              </TabsTrigger>
              <TabsTrigger value="request" className="text-xs">
                Request
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="headers"
              className="mt-3 min-h-0 flex-1 overflow-auto py-1"
            >
              {hasBody && (
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value="Content-Type"
                    disabled
                    className="h-8 font-mono text-sm"
                  />
                  <Input
                    {...register('contentType')}
                    placeholder="Content-Type"
                    className="h-8 max-w-md flex-1 font-mono text-sm"
                  />
                  <div className="flex h-9 shrink-0 cursor-not-allowed items-center justify-center px-4 text-muted-foreground">
                    <Lock className="size-4" />
                  </div>
                </div>
              )}
              <KeyValueEditor
                name="headers"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </TabsContent>
            <TabsContent
              value="params"
              className="mt-3 min-h-0 flex-1 overflow-auto py-1"
            >
              <KeyValueEditor
                name="params"
                keyPlaceholder="Param name"
                valuePlaceholder="Param value"
              />
            </TabsContent>
            <TabsContent
              value="request"
              className="mt-3 min-h-0 flex-1 overflow-auto py-1"
            >
              {hasBody ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      Content-Type
                    </span>
                    <ContentTypeCombobox />
                  </div>
                  <ExecuteRequestBodyEditor />
                </div>
              ) : (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  {method} requests do not have a body.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="shrink-0 overflow-auto border-t px-6 py-4 lg:h-[50%]">
          <ResponseArea response={response} />
        </div>
      </form>
    </Form>
  );
}
