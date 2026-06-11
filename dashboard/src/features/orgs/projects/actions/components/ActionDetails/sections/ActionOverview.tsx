import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { GraphQLSdlEditor } from '@/features/orgs/projects/actions/components/GraphQLSdlEditor';
import { composeActionDefinitionSdl } from '@/features/orgs/projects/actions/utils/composeActionDefinitionSdl';
import { composeTypesSdl } from '@/features/orgs/projects/actions/utils/composeTypesSdl';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
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
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
          Action Definition
        </h3>
        <GraphQLSdlEditor value={definitionSdl.trimEnd()} readOnly />
      </div>

      {typesSdl && (
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
            Type Configuration
          </h3>
          <GraphQLSdlEditor value={typesSdl.trimEnd()} readOnly />
        </div>
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
    </div>
  );
}
