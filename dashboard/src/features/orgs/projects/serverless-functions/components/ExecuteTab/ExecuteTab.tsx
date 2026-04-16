import { Loader2, Lock, Send } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
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
import { Textarea } from '@/components/ui/v3/textarea';
import { TruncatedText } from '@/features/orgs/projects/common/components/TruncatedText';
import { ContentTypeCombobox } from '@/features/orgs/projects/serverless-functions/components/ContentTypeCombobox';
import { KeyValueEditor } from '@/features/orgs/projects/serverless-functions/components/KeyValueEditor';
import { MultipartEditor } from '@/features/orgs/projects/serverless-functions/components/MultipartEditor';
import { ResponseArea } from '@/features/orgs/projects/serverless-functions/components/ResponseArea';
import type {
  ExecuteFormValues,
  HttpMethod,
  ResponseState,
} from '@/features/orgs/projects/serverless-functions/types';
import {
  buildRequestBody,
  buildRequestHeaders,
  buildRequestUrl,
} from '@/features/orgs/projects/serverless-functions/utils';
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

  const [requestTab, setRequestTab] = useState('headers');
  const [response, setResponse] = useState<ResponseState>({ status: 'idle' });

  const method = form.watch('method');
  const contentType = form.watch('contentType');
  const isJson = contentType.includes('json');
  const isXml = contentType.includes('xml');
  const isFormEncoded = contentType.includes(
    'application/x-www-form-urlencoded',
  );
  const isMultipart = contentType.includes('multipart/form-data');
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const sendRequest = useCallback(async () => {
    setResponse({ status: 'loading' });

    const values = form.getValues();
    const allHeaders = values.contentType
      ? [{ key: 'Content-Type', value: values.contentType }, ...values.headers]
      : values.headers;

    const fullUrl = buildRequestUrl(endpointUrl, values.params);
    const headersObj = buildRequestHeaders(allHeaders, isMultipart);
    const requestBody = buildRequestBody(values.method, {
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
      console.error('[Execute] Network error:', err);
      setResponse({
        status: 'error',
        statusCode: 0,
        statusText: err instanceof Error ? err.message : 'Network Error',
        body: err instanceof Error ? err.message : 'Failed to send request',
        duration,
      });
    }
  }, [form, endpointUrl, isFormEncoded, isMultipart]);

  return (
    <FormProvider {...form}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 space-y-4 overflow-auto p-6">
          <div className="flex items-center gap-2">
            <Select
              value={method}
              onValueChange={(val) =>
                form.setValue('method', val as HttpMethod)
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
                {(
                  [
                    'GET',
                    'POST',
                    'PUT',
                    'PATCH',
                    'DELETE',
                    'OPTIONS',
                    'HEAD',
                  ] as const
                ).map((m) => (
                  <SelectItem
                    key={m}
                    value={m}
                    className={cn('font-mono font-semibold', METHOD_COLORS[m])}
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
              <TruncatedText
                text={endpointUrl}
                tailLength={12}
              />
              <CopyToClipboardButton
                textToCopy={endpointUrl}
                title="Copy endpoint URL"
                className="ml-auto shrink-0"
              />
            </div>

            <Button
              type="button"
              onClick={sendRequest}
              disabled={response.status === 'loading'}
              className="h-10 gap-2"
            >
              {response.status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>

          <Tabs value={requestTab} onValueChange={setRequestTab}>
            <TabsList className="h-8">
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

            <TabsContent value="headers" className="mt-3">
              <div className="mb-2 flex cursor-not-allowed items-center gap-2">
                <Input
                  value="Content-Type"
                  disabled
                  className="h-8 cursor-not-allowed font-mono text-sm"
                />
                <Input
                  value={contentType || 'None'}
                  disabled
                  className="h-8 max-w-md flex-1 cursor-not-allowed font-mono text-sm"
                />
                <div className="flex h-9 shrink-0 cursor-not-allowed items-center justify-center px-4 text-muted-foreground">
                  <Lock className="size-4" />
                </div>
              </div>
              <KeyValueEditor
                name="headers"
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </TabsContent>
            <TabsContent value="params" className="mt-3">
              <KeyValueEditor
                name="params"
                keyPlaceholder="Param name"
                valuePlaceholder="Param value"
              />
            </TabsContent>
            <TabsContent value="request" className="mt-3">
              {!hasBody ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  {method} requests do not have a body.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      Content-Type
                    </span>
                    <ContentTypeCombobox />
                  </div>
                  {isFormEncoded ? (
                    <KeyValueEditor
                      name="formFields"
                      keyPlaceholder="Field name"
                      valuePlaceholder="Field value"
                    />
                  ) : isMultipart ? (
                    <MultipartEditor name="multipartFields" />
                  ) : (
                    <Textarea
                      {...form.register('body')}
                      placeholder={
                        isJson
                          ? '{\n  "key": "value"\n}'
                          : isXml
                            ? '<?xml version="1.0"?>\n<root />'
                            : 'Request body...'
                      }
                      className="min-h-32 font-mono text-sm"
                    />
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-auto h-[40%] shrink-0 overflow-auto border-t px-6 py-4">
          <ResponseArea response={response} />
        </div>
      </div>
    </FormProvider>
  );
}
