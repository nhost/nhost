import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import EventTriggerHeadersTable from '@/features/orgs/projects/events/event-triggers/components/EventTriggerView/sections/EventTriggerHeadersTable';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import TriggerOperationsSection from './TriggerOperationsSection';

export default function EventTriggerOverview({
  eventTrigger,
}: {
  eventTrigger: EventTriggerViewModel;
}) {
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);

  const queryParams = eventTrigger.request_transform?.query_params;
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

  const bodyTransform = eventTrigger.request_transform?.body;
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
            Database & Table
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Data Source:
              </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {eventTrigger.dataSource}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Schema:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {eventTrigger.table.schema}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Table:</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {eventTrigger.table.name}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            {'webhook' in eventTrigger
              ? 'Webhook Handler'
              : 'Webhook Handler (from environment)'}
          </h3>
          <div className="text-sm">
            <div className="flex items-center justify-between gap-2 break-all rounded bg-muted p-2 font-mono">
              <span>
                {'webhook' in eventTrigger
                  ? eventTrigger.webhook
                  : eventTrigger.webhook_from_env}
              </span>
              <CopyToClipboardButton
                className="bg-[#e3f4fc]/70 dark:bg-[#1e2942]/70 dark:hover:bg-[#253252]"
                textToCopy={
                  'webhook' in eventTrigger
                    ? eventTrigger.webhook
                    : eventTrigger.webhook_from_env
                }
                title="Copy webhook URL"
              />
            </div>
          </div>
        </div>
      </div>

      <TriggerOperationsSection eventTrigger={eventTrigger} />

      {eventTrigger.retry_conf && (
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Retry Configuration
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {eventTrigger.retry_conf.num_retries}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Max Retries
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {eventTrigger.retry_conf.interval_sec}s
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Retry Interval
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {eventTrigger.retry_conf.timeout_sec}s
              </div>
              <div className="text-gray-600 dark:text-gray-400">Timeout</div>
            </div>
          </div>
        </div>
      )}

      {eventTrigger.headers && (
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
              <div className="border-t border-gray-200 p-4 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <EventTriggerHeadersTable headers={eventTrigger.headers} />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {eventTrigger.request_transform && (
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
              <div className="space-y-4 border-t border-gray-200 p-4 pt-4 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {eventTrigger.request_transform?.method && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Method:{' '}
                      </span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {eventTrigger.request_transform.method}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Template Engine:{' '}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {eventTrigger.request_transform?.template_engine}
                    </span>
                  </div>
                </div>

                {eventTrigger.request_transform?.url && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      URL Template:
                    </div>
                    <div className="rounded p-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {eventTrigger.request_transform?.url}
                    </div>
                  </div>
                )}

                {queryParamsDisplay && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      Query Parameters:
                    </div>
                    <div className="rounded p-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                      {queryParamsDisplay}
                    </div>
                  </div>
                )}

                {bodyTransformDisplay && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      Body Template:
                    </div>
                    <div className="whitespace-pre-wrap rounded bg-gray-100 p-2 font-mono text-xs text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                      {bodyTransformDisplay}
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    Action:{' '}
                    {typeof eventTrigger.request_transform.body === 'object'
                      ? eventTrigger.request_transform.body?.action
                      : 'N/A'}
                  </span>
                  <span>Version: {eventTrigger.request_transform.version}</span>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
