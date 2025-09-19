import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import type { EventTriggerUI } from '@/features/orgs/projects/events/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import EventTriggerHeadersTable from '../EventTriggerHeadersTable/EventTriggerHeadersTable';

export default function EventTriggerOverview({
  eventTrigger,
}: {
  eventTrigger: EventTriggerUI;
}) {
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const operations: string[] = [];
  if (eventTrigger.definition.insert) {
    operations.push('Insert');
  }
  if (eventTrigger.definition.update) {
    operations.push('Update');
  }
  if (eventTrigger.definition.delete) {
    operations.push('Delete');
  }
  if (eventTrigger.definition.enable_manual) {
    operations.push('Manual (Dashboard)');
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
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

        <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Webhook Handler
          </h3>
          <div className="text-sm">
            <div className="break-all rounded bg-gray-100 p-2 font-mono text-xs text-gray-900 dark:bg-gray-700 dark:text-gray-100">
              {eventTrigger.webhook}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
          Trigger Operations
        </h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {operations.map((operation) => (
            <span
              key={operation}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-600 dark:text-gray-200"
            >
              {operation}
            </span>
          ))}
        </div>
        {eventTrigger.definition.insert && (
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Insert Columns:{' '}
            </span>
            <span className="font-mono text-gray-900 dark:text-gray-100">
              {eventTrigger.definition.insert.columns}
            </span>
          </div>
        )}
      </div>

      {eventTrigger.retry_conf && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
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
        <div className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Request Headers
          </h3>
          <div className="overflow-x-auto">
            <EventTriggerHeadersTable headers={eventTrigger.headers} />
          </div>
        </div>
      )}

      {eventTrigger.request_transform && (
        <Collapsible open={isTransformOpen} onOpenChange={setIsTransformOpen}>
          <div className="rounded border border-gray-200 dark:border-gray-700">
            <CollapsibleTrigger className="flex w-full items-center justify-between bg-gray-50 p-4 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
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
              <div className="space-y-4 border-t border-gray-200 bg-gray-50 p-4 pt-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Method:{' '}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {eventTrigger.request_transform?.method}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Template Engine:{' '}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {eventTrigger.request_transform?.template_engine}
                    </span>
                  </div>
                </div>

                <div className="text-sm">
                  <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                    URL Template:
                  </div>
                  <div className="rounded bg-gray-100 p-2 font-mono text-xs text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                    {eventTrigger.request_transform?.url}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                    Query Parameters:
                  </div>
                  <div className="rounded bg-gray-100 p-2 font-mono text-xs text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                    {eventTrigger.request_transform?.query_params?.toString()}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                    Body Template:
                  </div>
                  <div className="whitespace-pre-wrap rounded bg-gray-100 p-2 font-mono text-xs text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                    {eventTrigger.request_transform.body?.template}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    Action: {eventTrigger.request_transform.body?.action}
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
