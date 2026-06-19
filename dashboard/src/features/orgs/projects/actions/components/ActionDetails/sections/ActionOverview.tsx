import {
  ChevronDown,
  ChevronRight,
  Pencil,
  SlidersHorizontal,
  Webhook,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { EditActionForm } from '@/features/orgs/projects/actions/components/EditActionForm';
import { GraphQLSdlEditor } from '@/features/orgs/projects/actions/components/GraphQLSdlEditor';
import { composeActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/composeActionDefinitionSdl';
import { composeTypesSdl } from '@/features/orgs/projects/actions/utils/composeTypesSdl';
import { DEFAULT_ACTION_TIMEOUT_SECONDS } from '@/features/orgs/projects/actions/utils/constants';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { TruncatedText } from '@/features/orgs/projects/common/components/TruncatedText';
import { HeadersTable } from '@/features/orgs/projects/events/common/components/HeadersTable';
import { isNotEmptyValue } from '@/lib/utils';
import type {
  ActionItem,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';

export interface ActionOverviewProps {
  action: ActionItem;
  customTypes: CustomTypes;
}

export default function ActionOverview({
  action,
  customTypes,
}: ActionOverviewProps) {
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [isResponseTransformOpen, setIsResponseTransformOpen] = useState(false);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);
  const [isDefinitionOpen, setIsDefinitionOpen] = useState(true);
  const [isTypesOpen, setIsTypesOpen] = useState(true);
  const { openDrawer } = useDialog();
  const actionType = action.definition.type ?? 'mutation';

  const definitionSdl = useMemo(
    () =>
      composeActionDefinitionSdl({
        name: action.name,
        definition: action.definition,
      }),
    [action],
  );

  const typesSdl = useMemo(
    () =>
      composeTypesSdl(
        getActionTypes(action.definition, parseCustomTypes(customTypes)),
      ),
    [action, customTypes],
  );

  const requestTransform = action.definition.request_transform;
  const responseTransform = action.definition.response_transform;
  const responseTransformBody =
    typeof responseTransform?.body === 'object'
      ? responseTransform.body
      : undefined;

  const queryParams = requestTransform?.query_params;
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

  const editButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        openDrawer({
          title: 'Edit Action',
          component: <EditActionForm action={action} />,
        })
      }
    >
      <Pencil className="mr-2 h-3.5 w-3.5" />
      Edit
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <Webhook className="h-4 w-4" />
            Handler
          </h3>
          <div className="flex items-center justify-between gap-2 rounded bg-muted p-2 font-mono text-sm">
            <TruncatedText text={action.definition.handler} tailLength={12} />
            <CopyToClipboardButton
              textToCopy={action.definition.handler}
              title="Copy handler URL"
            />
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <SlidersHorizontal className="h-4 w-4" />
            Settings
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Handler timeout
              </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {action.definition.timeout ?? DEFAULT_ACTION_TIMEOUT_SECONDS}s
              </span>
            </div>
            {actionType === 'mutation' && (
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Kind</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {action.definition.kind ?? 'synchronous'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Collapsible
        open={isDefinitionOpen}
        onOpenChange={setIsDefinitionOpen}
        className="rounded border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between gap-2 px-4">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 py-4 text-left font-medium text-base text-gray-900 dark:text-gray-100">
            {isDefinitionOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
            Action Definition
          </CollapsibleTrigger>
          {editButton}
        </div>
        <CollapsibleContent>
          <div className="overflow-hidden border-gray-200 border-t dark:border-gray-700">
            <GraphQLSdlEditor
              value={definitionSdl.trimEnd()}
              readOnly
              className="rounded-none border-0"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {typesSdl && (
        <Collapsible
          open={isTypesOpen}
          onOpenChange={setIsTypesOpen}
          className="rounded border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between gap-2 px-4">
            <CollapsibleTrigger className="flex flex-1 items-center gap-2 py-4 text-left font-medium text-base text-gray-900 dark:text-gray-100">
              {isTypesOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
              Type Configuration
            </CollapsibleTrigger>
            {editButton}
          </div>
          <CollapsibleContent>
            <div className="overflow-hidden border-gray-200 border-t dark:border-gray-700">
              <GraphQLSdlEditor
                value={typesSdl.trimEnd()}
                readOnly
                className="rounded-none border-0"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {isNotEmptyValue(action.definition.headers) && (
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
                  <HeadersTable headers={action.definition.headers} />
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {requestTransform && (
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
                  {requestTransform.method && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Method:{' '}
                      </span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {requestTransform.method}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Template Engine:{' '}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {requestTransform.template_engine}
                    </span>
                  </div>
                </div>

                {requestTransform.url && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      URL Template:
                    </div>
                    <div className="rounded p-2 font-mono text-gray-900 text-xs dark:text-gray-100">
                      {requestTransform.url}
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

                {typeof requestTransform.body === 'object' &&
                  requestTransform.body.template && (
                    <div className="text-sm">
                      <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                        Body Template:
                      </div>
                      <pre className="overflow-x-auto rounded p-2 font-mono text-gray-900 text-xs dark:text-gray-100">
                        {requestTransform.body.template}
                      </pre>
                    </div>
                  )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {responseTransform && (
        <Collapsible
          open={isResponseTransformOpen}
          onOpenChange={setIsResponseTransformOpen}
        >
          <div className="rounded border border-gray-200 dark:border-gray-700">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Response Transform Configuration
              </h3>
              {isResponseTransformOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 border-gray-200 border-t p-4 pt-4 dark:border-gray-700">
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Template Engine:{' '}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {responseTransform.template_engine}
                  </span>
                </div>

                {responseTransformBody?.template && (
                  <div className="text-sm">
                    <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                      Body Template:
                    </div>
                    <pre className="overflow-x-auto rounded p-2 font-mono text-gray-900 text-xs dark:text-gray-100">
                      {responseTransformBody.template}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
