import { subMinutes } from 'date-fns';
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Cpu,
  FileCode,
  GitCommit,
  Globe,
  Inbox,
  Loader2,
  Lock,
  Plus,
  ScrollText,
  Send,
  Trash,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useMemo, useRef, useState } from 'react';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandCreateItem,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { Input } from '@/components/ui/v3/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { Textarea } from '@/components/ui/v3/textarea';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import { FunctionLogsTab } from '@/features/orgs/projects/serverless-functions/components/FunctionLogsTab';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';
import { cn } from '@/lib/utils';
import {
  type GetProjectLogsQuery,
  useGetFunctionsLogsQuery,
} from '@/utils/__generated__/graphql';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';

type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

interface KeyValuePair {
  key: string;
  value: string;
}

interface MultipartField {
  key: string;
  value: string;
  file: File | null;
}

interface ResponseState {
  status: 'idle' | 'loading' | 'success' | 'error';
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  duration?: number;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600 dark:text-green-400',
  POST: 'text-blue-600 dark:text-blue-400',
  PUT: 'text-orange-600 dark:text-orange-400',
  PATCH: 'text-pink-600 dark:text-pink-400',
  DELETE: 'text-red-600 dark:text-red-400',
  OPTIONS: 'text-purple-600 dark:text-purple-400',
  HEAD: 'text-teal-600 dark:text-teal-400',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function MetadataCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 p-4 dark:border-gray-700',
        className,
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  );
}

function RecentLogsCard({
  fn,
  onViewAll,
}: {
  fn: NhostFunction;
  onViewAll: () => void;
}) {
  const { project } = useProject();

  const { from, to } = useMemo(() => {
    const now = new Date();
    return {
      from: subMinutes(now, 15).toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const { data, loading, error } = useGetFunctionsLogsQuery({
    variables: {
      appID: project?.id,
      from,
      to,
      path: fn.route,
    },
    client: splitGraphqlClient,
    skip: !project?.id,
  });

  const logsData = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return { logs: data.getFunctionsLogs } as unknown as GetProjectLogsQuery;
  }, [data]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-muted-foreground text-sm">
          <ScrollText className="h-4 w-4" />
          Recent Logs
          <span className="text-xs">(15m)</span>
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-primary text-xs hover:underline"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-72">
        <LogsBody
          logsData={logsData}
          loading={loading}
          error={error}
          hideServiceColumn
        />
      </div>
    </div>
  );
}

function OverviewTab({
  fn,
  endpointUrl,
  defaultEndpointUrl,
  onViewAllLogs,
}: {
  fn: NhostFunction;
  endpointUrl: string;
  defaultEndpointUrl?: string;
  onViewAllLogs: () => void;
}) {
  const { orgSlug, appSubdomain } = useRouter().query;
  return (
    <div className="space-y-4">
      <MetadataCard title="Endpoint" icon={Globe} className="col-span-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded bg-muted p-2 font-mono text-sm">
            <span className="break-all">{endpointUrl}</span>
            <CopyToClipboardButton
              textToCopy={endpointUrl}
              title="Copy endpoint URL"
            />
          </div>
          {defaultEndpointUrl && (
            <div>
              <p className="mb-1 text-muted-foreground text-xs">
                Default endpoint
              </p>
              <div className="flex items-center justify-between gap-2 rounded bg-muted/50 p-2 font-mono text-muted-foreground text-xs">
                <span className="break-all">{defaultEndpointUrl}</span>
                <CopyToClipboardButton
                  textToCopy={defaultEndpointUrl}
                  title="Copy default endpoint URL"
                />
              </div>
            </div>
          )}
        </div>
      </MetadataCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetadataCard title="Runtime" icon={Cpu}>
          <div className="space-y-2">
            <MetadataRow label="Runtime" value={fn.runtime} />
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Route</span>
              <TextWithTooltip
                containerClassName="min-w-0"
                className="font-mono text-gray-900 dark:text-gray-100"
                truncateMode="middle"
                tailLength={12}
                text={fn.route}
              />
            </div>
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">File</span>
              <TextWithTooltip
                containerClassName="min-w-0"
                className="font-mono text-gray-900 dark:text-gray-100"
                truncateMode="middle"
                tailLength={12}
                text={fn.path}
              />
            </div>
          </div>
        </MetadataCard>

        <MetadataCard title="Deployment" icon={GitCommit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Commit</span>
              <div className="flex items-center gap-1">
                <Link
                  href={`/orgs/${orgSlug}/projects/${appSubdomain}/deployments`}
                  className="hover:underline"
                >
                  <Badge variant="outline" className="font-mono text-xs">
                    {fn.createdWithCommitSha.slice(0, 7)}
                  </Badge>
                </Link>
                <CopyToClipboardButton
                  textToCopy={fn.createdWithCommitSha}
                  title="Copy commit SHA"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="shrink-0 text-gray-600 dark:text-gray-400">
                Checksum
              </span>
              <div className="flex min-w-0 items-center gap-1">
                <TextWithTooltip
                  containerClassName="min-w-0"
                  className="font-mono text-gray-900 text-xs dark:text-gray-100"
                  truncateMode="middle"
                  text={fn.checksum}
                />
                <CopyToClipboardButton
                  textToCopy={fn.checksum}
                  title="Copy checksum"
                />
              </div>
            </div>
          </div>
        </MetadataCard>
      </div>

      <MetadataCard title="Timestamps" icon={Clock}>
        <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-2">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Created</span>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {formatDate(fn.createdAt)}
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Updated</span>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {formatDate(fn.updatedAt)}
            </div>
          </div>
        </div>
      </MetadataCard>

      <RecentLogsCard fn={fn} onViewAll={onViewAllLogs} />
    </div>
  );
}

function KeyValueEditor({
  pairs,
  onChange,
  lockedKeys = [],
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  lockedKeys?: string[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const addRow = () => {
    onChange([...pairs, { key: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...pairs];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {pairs.map((pair, index) => {
        const isLocked = lockedKeys.some(
          (k) => k.toLowerCase() === pair.key.toLowerCase(),
        );

        return (
          <div
            key={`pair-${index.toString()}`}
            className="flex items-center gap-2"
          >
            <Input
              placeholder={keyPlaceholder}
              value={pair.key}
              onChange={(e) => updateRow(index, 'key', e.target.value)}
              className="h-8 font-mono text-sm"
              disabled={isLocked}
            />
            <Input
              placeholder={valuePlaceholder}
              value={pair.value}
              onChange={(e) => updateRow(index, 'value', e.target.value)}
              className="h-8 max-w-md flex-1 font-mono text-sm"
              disabled={isLocked}
            />
            {isLocked ? (
              <div className="flex h-9 shrink-0 items-center justify-center px-4 text-muted-foreground">
                <Lock className="size-4" />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeRow(index)}
              >
                <Trash className="size-4" />
              </Button>
            )}
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="gap-1" onClick={addRow}>
        <Plus className="h-3 w-3" />
        Add row
      </Button>
    </div>
  );
}

function MultipartEditor({
  fields,
  onChange,
}: {
  fields: MultipartField[];
  onChange: (fields: MultipartField[]) => void;
}) {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addRow = () => {
    onChange([...fields, { key: '', value: '', file: null }]);
  };

  const removeRow = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateKey = (index: number, key: string) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], key };
    onChange(updated);
  };

  const updateValue = (index: number, value: string) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], value };
    onChange(updated);
  };

  const updateFile = (index: number, file: File | null) => {
    const updated = [...fields];
    updated[index] = {
      ...updated[index],
      file,
      value: file ? file.name : '',
    };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div
          key={`multipart-${index.toString()}`}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Parameter name"
            value={field.key}
            onChange={(e) => updateKey(index, e.target.value)}
            className="h-8 font-mono text-sm"
          />
          <Input
            placeholder="Value"
            value={field.file ? field.file.name : field.value}
            onChange={(e) => updateValue(index, e.target.value)}
            className="h-8 font-mono text-sm"
            disabled={!!field.file}
          />
          <input
            ref={(el) => {
              fileInputRefs.current[index] = el;
            }}
            type="file"
            className="hidden"
            onChange={(e) => updateFile(index, e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              if (field.file) {
                updateFile(index, null);
              } else {
                fileInputRefs.current[index]?.click();
              }
            }}
            title={field.file ? 'Remove file' : 'Choose file'}
          >
            {field.file ? (
              <X className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeRow(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1" onClick={addRow}>
        <Plus className="h-3 w-3" />
        Add row
      </Button>
    </div>
  );
}

function ResponseArea({ response }: { response: ResponseState }) {
  const [responseTab, setResponseTab] = useState('body');

  if (response.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">Send a request to see the response here</p>
      </div>
    );
  }

  if (response.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Sending request...</p>
      </div>
    );
  }

  const statusColor =
    response.statusCode && response.statusCode < 300
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : response.statusCode && response.statusCode < 500
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

  let formattedBody = response.body ?? '';
  try {
    formattedBody = JSON.stringify(JSON.parse(formattedBody), null, 2);
  } catch {
    // keep raw
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between border-gray-200 border-b px-4 py-2 dark:border-gray-700">
        <Badge className={cn('font-mono text-xs', statusColor)}>
          {response.statusCode} {response.statusText}
        </Badge>
        {response.duration !== undefined && (
          <span className="text-muted-foreground text-xs">
            {response.duration}ms
          </span>
        )}
      </div>

      <Tabs value={responseTab} onValueChange={setResponseTab}>
        <TabsList className="mt-2 ml-4 h-8">
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="mt-0 p-4">
          <pre className="max-h-64 overflow-auto rounded bg-muted p-3 font-mono text-sm">
            {formattedBody}
          </pre>
        </TabsContent>
        <TabsContent value="headers" className="mt-0 p-4">
          <div className="space-y-1">
            {Object.entries(response.headers ?? {}).map(([key, value]) => (
              <div key={key} className="flex gap-2 font-mono text-sm">
                <span className="text-muted-foreground">{key}:</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Only CORS-exposed headers are visible from the browser.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExecuteTab({ endpointUrl }: { endpointUrl: string }) {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: 'Content-Type', value: 'application/json' },
  ]);
  const [params, setParams] = useState<KeyValuePair[]>([]);
  const [body, setBody] = useState('');
  const [formFields, setFormFields] = useState<KeyValuePair[]>([
    { key: '', value: '' },
  ]);
  const [multipartFields, setMultipartFields] = useState<MultipartField[]>([
    { key: '', value: '', file: null },
  ]);
  const [requestTab, setRequestTab] = useState('headers');
  const [contentTypeOpen, setContentTypeOpen] = useState(false);

  const contentType =
    headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
  const isJson = contentType.includes('json');
  const isXml = contentType.includes('xml');
  const isFormEncoded = contentType.includes(
    'application/x-www-form-urlencoded',
  );
  const isMultipart = contentType.includes('multipart/form-data');
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const setContentType = (value: string) => {
    const idx = headers.findIndex(
      (h) => h.key.toLowerCase() === 'content-type',
    );
    if (value === '') {
      if (idx !== -1) {
        setHeaders(headers.filter((_, i) => i !== idx));
      }
      return;
    }
    if (idx !== -1) {
      const updated = [...headers];
      updated[idx] = { ...updated[idx], value };
      setHeaders(updated);
    } else {
      setHeaders([{ key: 'Content-Type', value }, ...headers]);
    }
  };
  const [response, setResponse] = useState<ResponseState>({ status: 'idle' });

  const sendRequest = useCallback(async () => {
    setResponse({ status: 'loading' });

    const queryString = params
      .filter((p) => p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');

    const fullUrl = queryString ? `${endpointUrl}?${queryString}` : endpointUrl;

    const headersObj: Record<string, string> = {};
    for (const h of headers) {
      if (h.key) {
        headersObj[h.key] = h.value;
      }
    }

    let requestBody: BodyInit | undefined;
    if (hasBody) {
      if (isMultipart) {
        const formData = new FormData();
        for (const field of multipartFields) {
          if (field.key) {
            if (field.file) {
              formData.append(field.key, field.file);
            } else {
              formData.append(field.key, field.value);
            }
          }
        }
        requestBody = formData;
        delete headersObj['Content-Type'];
      } else if (isFormEncoded) {
        const encoded = formFields
          .filter((f) => f.key)
          .map(
            (f) =>
              `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`,
          )
          .join('&');
        requestBody = encoded || undefined;
      } else {
        requestBody = body || undefined;
      }
    }

    const start = performance.now();
    try {
      const res = await fetch(fullUrl, {
        method,
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
  }, [
    method,
    endpointUrl,
    headers,
    params,
    body,
    formFields,
    multipartFields,
    hasBody,
    isFormEncoded,
    isMultipart,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select
          value={method}
          onValueChange={(val) => setMethod(val as HttpMethod)}
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
          <TextWithTooltip
            containerClassName="min-w-0"
            truncateMode="middle"
            tailLength={
              endpointUrl.includes('nhost.run')
                ? endpointUrl.length - endpointUrl.indexOf('nhost.run')
                : 12
            }
            text={endpointUrl}
          />
          <CopyToClipboardButton
            textToCopy={endpointUrl}
            title="Copy endpoint URL"
            className="ml-auto shrink-0"
          />
        </div>

        <Button
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
          <KeyValueEditor
            pairs={headers}
            onChange={setHeaders}
            lockedKeys={['Content-Type']}
            keyPlaceholder="Header name"
            valuePlaceholder="Header value"
          />
        </TabsContent>
        <TabsContent value="params" className="mt-3">
          <KeyValueEditor
            pairs={params}
            onChange={setParams}
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
                <Popover
                  open={contentTypeOpen}
                  onOpenChange={setContentTypeOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contentTypeOpen}
                      className="h-8 w-80 justify-between font-normal text-sm"
                    >
                      <span className="truncate">{contentType || 'None'}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0"
                  >
                    <Command>
                      <CommandInput placeholder="Search or enter custom..." />
                      <CommandList>
                        <CommandEmpty>No content type found.</CommandEmpty>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setContentType('');
                            setContentTypeOpen(false);
                          }}
                        >
                          None
                          <Check
                            className={cn(
                              'ml-auto h-4 w-4',
                              !contentType ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                        <CommandGroup heading="JSON / XML">
                          {[
                            'application/json',
                            'application/ld+json',
                            'application/hal+json',
                            'application/vnd.api+json',
                            'application/xml',
                            'text/xml',
                          ].map((ct) => (
                            <CommandItem
                              key={ct}
                              value={ct}
                              onSelect={() => {
                                setContentType(ct);
                                setContentTypeOpen(false);
                              }}
                            >
                              {ct}
                              <Check
                                className={cn(
                                  'ml-auto h-4 w-4',
                                  contentType === ct
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Form">
                          {[
                            'application/x-www-form-urlencoded',
                            'multipart/form-data',
                          ].map((ct) => (
                            <CommandItem
                              key={ct}
                              value={ct}
                              onSelect={() => {
                                setContentType(ct);
                                setContentTypeOpen(false);
                              }}
                            >
                              {ct}
                              <Check
                                className={cn(
                                  'ml-auto h-4 w-4',
                                  contentType === ct
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Text">
                          {['text/html', 'text/plain'].map((ct) => (
                            <CommandItem
                              key={ct}
                              value={ct}
                              onSelect={() => {
                                setContentType(ct);
                                setContentTypeOpen(false);
                              }}
                            >
                              {ct}
                              <Check
                                className={cn(
                                  'ml-auto h-4 w-4',
                                  contentType === ct
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandCreateItem
                          onCreate={(value) => {
                            setContentType(value);
                            setContentTypeOpen(false);
                          }}
                        />
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {isFormEncoded ? (
                <KeyValueEditor
                  pairs={formFields}
                  onChange={setFormFields}
                  keyPlaceholder="Field name"
                  valuePlaceholder="Field value"
                />
              ) : isMultipart ? (
                <MultipartEditor
                  fields={multipartFields}
                  onChange={setMultipartFields}
                />
              ) : (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
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

      <ResponseArea response={response} />
    </div>
  );
}

function FunctionDetailsPanel({ fn }: { fn: NhostFunction }) {
  const [tab, setTab] = useState('overview');
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const appClient = useAppClient();
  const defaultEndpointUrl = `${appClient.functions.baseURL}${fn.route}`;

  const { data: customDomainData } = useGetServerlessFunctionsSettingsQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const customDomainFqdn =
    customDomainData?.config?.functions?.resources?.networking?.ingresses?.[0]
      ?.fqdn?.[0];

  const endpointUrl = customDomainFqdn
    ? `https://${customDomainFqdn}/v1${fn.route}`
    : defaultEndpointUrl;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 bg-background px-6 pt-6 pb-0">
        <div className="pb-6">
          <h1 className="mb-1 font-semibold text-gray-900 text-xl dark:text-gray-100">
            {fn.route}
          </h1>
          <p className="flex items-center gap-1.5 text-gray-600 text-sm dark:text-gray-400">
            <FileCode className="h-3.5 w-3.5" />
            {fn.path}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="my-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'logs' ? (
        <div className="flex-1 overflow-hidden">
          <FunctionLogsTab fn={fn} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          {tab === 'overview' && (
            <OverviewTab
              fn={fn}
              endpointUrl={endpointUrl}
              defaultEndpointUrl={
                customDomainFqdn ? defaultEndpointUrl : undefined
              }
              onViewAllLogs={() => setTab('logs')}
            />
          )}
          {tab === 'execute' && <ExecuteTab endpointUrl={defaultEndpointUrl} />}
        </div>
      )}
    </div>
  );
}

export default function ServerlessFunctionView() {
  const router = useRouter();
  const { functionSlug } = router.query;
  const slug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : (functionSlug as string);

  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{slug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  const fn = functions.find((f) => f.route.replace(/^\//, '') === slug);

  if (!fn) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{slug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return <FunctionDetailsPanel fn={fn} />;
}
