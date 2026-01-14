import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { HeadersTable } from '@/features/orgs/projects/events/common/components/HeadersTable';
import { isNotEmptyValue } from '@/lib/utils';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export default function CronTriggerOverview({
  cronTrigger,
}: {
  cronTrigger: CronTrigger;
}) {
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);

  const queryParams = cronTrigger.request_transform?.query_params;
  let queryParamsDisplay = '';
  if (typeof queryParams === 'string') {
    queryParamsDisplay = queryParams;
  } else if (queryParams) {
    queryParamsDisplay = Object.entries(queryParams)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
  }

  const bodyTransform = cronTrigger.request_transform?.body;
  let bodyTransformDisplay = '';
  if (typeof bodyTransform === 'string') {
    bodyTransformDisplay = bodyTransform;
  } else if (bodyTransform) {
    bodyTransformDisplay = Object.entries(bodyTransform.form_template ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Cron Trigger Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Name:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {cronTrigger.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Comment:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {cronTrigger.comment}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Schedule:
              </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {cronTrigger.schedule}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            {'webhook' in cronTrigger
              ? 'Webhook Handler'
              : 'Webhook Handler (from environment)'}
          </h3>
          <div className="text-sm">
            <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
              <span>{cronTrigger.webhook}</span>
              <CopyToClipboardButton
                className="dark:bg-[#1e2942]/70 dark:hover:bg-[#253252]"
                textToCopy={cronTrigger.webhook}
                title="Copy webhook URL"
              />
            </div>
          </div>
        </div>
      </div>

      {cronTrigger.retry_conf && (
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Retry Configuration
          </h3>
          <div className="grid gap-4 text-sm lg:grid-cols-4">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {cronTrigger.retry_conf.num_retries}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Max Retries
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {cronTrigger.retry_conf.retry_interval_seconds}s
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Retry Interval
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {cronTrigger.retry_conf.timeout_seconds}s
              </div>
              <div className="text-gray-600 dark:text-gray-400">Timeout</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {cronTrigger.retry_conf.tolerance_seconds}s
              </div>
              <div className="text-gray-600 dark:text-gray-400">Tolerance</div>
            </div>
          </div>
        </div>
      )}
      {cronTrigger.payload && (
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Payload
          </h3>
          <div className="text-sm">
            <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
              <span>{JSON.stringify(cronTrigger.payload, null, 2)}</span>
            </div>
          </div>
        </div>
      )}

      {isNotEmptyValue(cronTrigger.headers) && (
        <Collapsible open={isHeadersOpen} onOpenChange={setIsHeadersOpen}>
          <div className="rounded border border-gray-200 dark:border-gray-700">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Request Headers
              </h3>
              {isHeadersOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-gray-200 border-t p-4 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <HeadersTable headers={cronTrigger.headers} />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {cronTrigger.request_transform && (
        <Collapsible open={isTransformOpen} onOpenChange={setIsTransformOpen}>
          <div className="rounded border border-gray-200 dark:border-gray-700">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Request Transform Configuration
              </h3>
              {isTransformOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 border-gray-200 border-t p-4 pt-4 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {cronTrigger.request_transform?.method && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Method:{' '}
                      </span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {cronTrigger.request_transform.method}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Template Engine:{' '}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {cronTrigger.request_transform?.template_engine}
                    </span>
                  </div>
                </div>

                {cronTrigger.request_transform?.url && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      URL Template:
                    </div>
                    <div className="rounded p-2 font-mono text-gray-900 text-xs dark:text-gray-100">
                      {cronTrigger.request_transform?.url}
                    </div>
                  </div>
                )}

                {queryParamsDisplay && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      Query Parameters:
                    </div>
                    <div className="rounded p-2 font-mono text-gray-900 text-xs dark:text-gray-100">
                      {queryParamsDisplay}
                    </div>
                  </div>
                )}

                {bodyTransformDisplay && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      Body Template:
                    </div>
                    <div className="whitespace-pre-wrap rounded bg-gray-100 p-2 font-mono text-gray-900 text-xs dark:bg-gray-700 dark:text-gray-100">
                      {bodyTransformDisplay}
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-gray-600 text-xs dark:text-gray-400">
                  <span>
                    Action:{' '}
                    {typeof cronTrigger.request_transform.body === 'object'
                      ? cronTrigger.request_transform.body?.action
                      : 'N/A'}
                  </span>
                  <span>Version: {cronTrigger.request_transform.version}</span>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
