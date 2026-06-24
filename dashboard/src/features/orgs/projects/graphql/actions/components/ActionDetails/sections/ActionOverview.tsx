import { Pencil, SlidersHorizontal, Webhook } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import CollapsibleSection from '@/features/orgs/projects/graphql/actions/components/ActionDetails/sections/CollapsibleSection';
import { EditActionForm } from '@/features/orgs/projects/graphql/actions/components/EditActionForm';
import { GraphQLSdlEditor } from '@/features/orgs/projects/graphql/actions/components/GraphQLSdlEditor';
import { composeActionDefinitionSdl } from '@/features/orgs/projects/graphql/actions/utils/composeActionDefinitionSdl';
import { composeTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/composeTypesSdl';
import { DEFAULT_ACTION_TIMEOUT_SECONDS } from '@/features/orgs/projects/graphql/actions/utils/constants';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
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
        <div className="rounded border p-4">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
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

        <div className="rounded border p-4">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Settings
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Handler timeout</span>
              <span className="font-mono text-foreground">
                {action.definition.timeout ?? DEFAULT_ACTION_TIMEOUT_SECONDS}s
              </span>
            </div>
            {actionType === 'mutation' && (
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Kind</span>
                <span className="font-mono text-foreground">
                  {action.definition.kind ?? 'synchronous'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <CollapsibleSection
        title="Action Definition"
        open={isDefinitionOpen}
        onOpenChange={setIsDefinitionOpen}
        action={editButton}
      >
        <div className="overflow-hidden border-t">
          <GraphQLSdlEditor
            value={definitionSdl.trimEnd()}
            readOnly
            className="rounded-none border-0"
          />
        </div>
      </CollapsibleSection>

      {typesSdl && (
        <CollapsibleSection
          title="Type Configuration"
          open={isTypesOpen}
          onOpenChange={setIsTypesOpen}
          action={editButton}
        >
          <div className="overflow-hidden border-t">
            <GraphQLSdlEditor
              value={typesSdl.trimEnd()}
              readOnly
              className="rounded-none border-0"
            />
          </div>
        </CollapsibleSection>
      )}

      {isNotEmptyValue(action.definition.headers) && (
        <CollapsibleSection
          title="Request Headers"
          open={isHeadersOpen}
          onOpenChange={setIsHeadersOpen}
        >
          <div className="border-t p-4">
            <div className="overflow-x-auto">
              <HeadersTable headers={action.definition.headers} />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {requestTransform && (
        <CollapsibleSection
          title="Request Transform Configuration"
          open={isTransformOpen}
          onOpenChange={setIsTransformOpen}
        >
          <div className="space-y-4 border-t p-4 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {requestTransform.method && (
                <div>
                  <span className="text-muted-foreground">Method: </span>
                  <span className="font-mono text-foreground">
                    {requestTransform.method}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Template Engine: </span>
                <span className="font-mono text-foreground">
                  {requestTransform.template_engine}
                </span>
              </div>
            </div>

            {requestTransform.url && (
              <div className="text-sm">
                <div className="mb-1 font-medium text-foreground">
                  URL Template:
                </div>
                <div className="rounded p-2 font-mono text-foreground text-xs">
                  {requestTransform.url}
                </div>
              </div>
            )}

            {queryParamsDisplay && (
              <div className="text-sm">
                <div className="mb-1 font-medium text-foreground">
                  Query Parameters:
                </div>
                <div className="rounded p-2 font-mono text-foreground text-xs">
                  {queryParamsDisplay}
                </div>
              </div>
            )}

            {typeof requestTransform.body === 'object' &&
              requestTransform.body.template && (
                <div className="text-sm">
                  <div className="mb-1 font-medium text-foreground">
                    Body Template:
                  </div>
                  <pre className="overflow-x-auto rounded p-2 font-mono text-foreground text-xs">
                    {requestTransform.body.template}
                  </pre>
                </div>
              )}
          </div>
        </CollapsibleSection>
      )}

      {responseTransform && (
        <CollapsibleSection
          title="Response Transform Configuration"
          open={isResponseTransformOpen}
          onOpenChange={setIsResponseTransformOpen}
        >
          <div className="space-y-4 border-t p-4 pt-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Template Engine: </span>
              <span className="font-mono text-foreground">
                {responseTransform.template_engine}
              </span>
            </div>

            {responseTransformBody?.template && (
              <div className="text-sm">
                <div className="mb-1 font-medium text-foreground">
                  Body Template:
                </div>
                <pre className="overflow-x-auto rounded p-2 font-mono text-foreground text-xs">
                  {responseTransformBody.template}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
