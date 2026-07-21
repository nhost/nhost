import { yupResolver } from '@hookform/resolvers/yup';
import { InfoIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { SelectItem } from '@/components/ui/v3/select';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { ToolsConfigFormSection } from '@/features/orgs/projects/ai/AgentForm/components/ToolsConfigFormSection';
import {
  type AgentFormValues,
  validationSchema,
} from '@/features/orgs/projects/ai/AgentForm/validation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import {
  GraphiteAgentProviders_Enum,
  useInsertAgentMutation,
  useUpdateAgentMutation,
} from '@/utils/__generated__/graphite.graphql';

export type { AgentFormValues };

export interface AgentFormProps extends DialogFormProps {
  agentId?: string;
  initialData?: AgentFormValues;
  onCancel?: () => Promise<unknown>;
  onSubmit?: () => Promise<unknown>;
}

interface ToolsConfig {
  web_search?: {
    provider: string;
    require_approval?: boolean;
  };
  web_fetch?: {
    require_approval?: boolean;
  };
  graphql?: {
    require_approval_queries?: boolean;
    require_approval_mutations?: boolean;
  };
  mcp_servers?: Array<{
    url: string;
    headers?: Record<string, string>;
    require_approval?: boolean;
    tool_overrides?: Record<string, { require_approval?: boolean }>;
  }>;
}

export function toolsConfigToFormValues(config: ToolsConfig | null): {
  webSearchEnabled: boolean;
  webSearchProvider: string;
  webSearchRequireApproval: boolean;
  webFetchEnabled: boolean;
  webFetchRequireApproval: boolean;
  graphqlEnabled: boolean;
  graphqlRequireApprovalQueries: boolean;
  graphqlRequireApprovalMutations: boolean;
  mcpServers: Array<{
    url: string;
    headers: string;
    requireApproval: boolean;
    toolOverrides: string;
  }>;
} {
  if (!config) {
    return {
      webSearchEnabled: false,
      webSearchProvider: '',
      webSearchRequireApproval: false,
      webFetchEnabled: false,
      webFetchRequireApproval: false,
      graphqlEnabled: false,
      graphqlRequireApprovalQueries: false,
      graphqlRequireApprovalMutations: false,
      mcpServers: [],
    };
  }

  return {
    webSearchEnabled: !!config.web_search,
    webSearchProvider: config.web_search?.provider ?? '',
    webSearchRequireApproval: config.web_search?.require_approval ?? false,
    webFetchEnabled: !!config.web_fetch,
    webFetchRequireApproval: config.web_fetch?.require_approval ?? false,
    graphqlEnabled: !!config.graphql,
    graphqlRequireApprovalQueries:
      config.graphql?.require_approval_queries ?? false,
    graphqlRequireApprovalMutations:
      config.graphql?.require_approval_mutations ?? false,
    mcpServers: (config.mcp_servers ?? []).map((server) => ({
      url: server.url,
      headers: server.headers ? JSON.stringify(server.headers, null, 2) : '',
      requireApproval: server.require_approval ?? false,
      toolOverrides: server.tool_overrides
        ? JSON.stringify(server.tool_overrides, null, 2)
        : '',
    })),
  };
}

function formValuesToToolsConfig(values: AgentFormValues): ToolsConfig | null {
  const config: ToolsConfig = {};
  let hasTools = false;

  if (values.webSearchEnabled && values.webSearchProvider) {
    config.web_search = {
      provider: values.webSearchProvider,
    };
    if (values.webSearchRequireApproval) {
      config.web_search.require_approval = true;
    }
    hasTools = true;
  }

  if (values.webFetchEnabled) {
    config.web_fetch = {};
    if (values.webFetchRequireApproval) {
      config.web_fetch.require_approval = true;
    }
    hasTools = true;
  }

  if (values.graphqlEnabled) {
    config.graphql = {};
    if (values.graphqlRequireApprovalQueries) {
      config.graphql.require_approval_queries = true;
    }
    if (values.graphqlRequireApprovalMutations) {
      config.graphql.require_approval_mutations = true;
    }
    hasTools = true;
  }

  if (values.mcpServers && values.mcpServers.length > 0) {
    config.mcp_servers = values.mcpServers.map((server) => {
      const entry: NonNullable<ToolsConfig['mcp_servers']>[number] = {
        url: server.url,
      };
      if (server.headers?.trim()) {
        entry.headers = JSON.parse(server.headers);
      }
      if (server.requireApproval) {
        entry.require_approval = true;
      }
      if (server.toolOverrides?.trim()) {
        entry.tool_overrides = JSON.parse(server.toolOverrides);
      }
      return entry;
    });
    hasTools = true;
  }

  return hasTools ? config : null;
}

const providerLabels: Record<GraphiteAgentProviders_Enum, string> = {
  [GraphiteAgentProviders_Enum.Anthropic]: 'Anthropic',
  [GraphiteAgentProviders_Enum.Google]: 'Google',
  [GraphiteAgentProviders_Enum.Openai]: 'OpenAI',
};

const defaultToolsValues = toolsConfigToFormValues(null);

export default function AgentForm({
  agentId,
  initialData,
  onSubmit,
  onCancel,
  location,
}: AgentFormProps) {
  const { onDirtyStateChange, closeDrawerWithDirtyGuard } = useDialog();
  const adminClient = useRemoteApplicationGQLClient();

  const [insertAgentMutation] = useInsertAgentMutation({
    client: adminClient,
  });

  const [updateAgentMutation] = useUpdateAgentMutation({
    client: adminClient,
  });

  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      instructions: initialData?.instructions ?? '',
      provider: initialData?.provider ?? undefined,
      model: initialData?.model ?? '',
      webSearchEnabled:
        initialData?.webSearchEnabled ?? defaultToolsValues.webSearchEnabled,
      webSearchProvider:
        initialData?.webSearchProvider ?? defaultToolsValues.webSearchProvider,
      webSearchRequireApproval:
        initialData?.webSearchRequireApproval ??
        defaultToolsValues.webSearchRequireApproval,
      webFetchEnabled:
        initialData?.webFetchEnabled ?? defaultToolsValues.webFetchEnabled,
      webFetchRequireApproval:
        initialData?.webFetchRequireApproval ??
        defaultToolsValues.webFetchRequireApproval,
      graphqlEnabled:
        initialData?.graphqlEnabled ?? defaultToolsValues.graphqlEnabled,
      graphqlRequireApprovalQueries:
        initialData?.graphqlRequireApprovalQueries ??
        defaultToolsValues.graphqlRequireApprovalQueries,
      graphqlRequireApprovalMutations:
        initialData?.graphqlRequireApprovalMutations ??
        defaultToolsValues.graphqlRequireApprovalMutations,
      mcpServers: initialData?.mcpServers ?? defaultToolsValues.mcpServers,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const handleSubmit = async (values: AgentFormValues) => {
    const toolsConfig = formValuesToToolsConfig(values);

    const payload = {
      name: values.name,
      description: values.description,
      instructions: values.instructions,
      provider: values.provider as GraphiteAgentProviders_Enum,
      model: values.model,
      toolsConfig,
    };

    await execPromiseWithErrorToast(
      async () => {
        if (agentId) {
          await updateAgentMutation({
            variables: {
              id: agentId,
              set: payload,
            },
          });
        } else {
          await insertAgentMutation({
            variables: {
              object: payload,
            },
          });
        }
        await onSubmit?.();
        closeDrawerWithDirtyGuard();
      },
      {
        loadingMessage: 'Configuring the Agent...',
        successMessage: 'The Agent has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the Agent. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden border-t"
      >
        <div className="flex flex-1 flex-col space-y-4 overflow-auto p-4">
          <Input
            {...register('name')}
            id="name"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Name</Text>
                <Tooltip title="Name of the agent">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.name}
            helperText={errors?.name?.message}
            fullWidth
            autoComplete="off"
            autoFocus
          />

          <Input
            {...register('description')}
            id="description"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Description</Text>
                <Tooltip title="Description of the agent">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.description}
            helperText={errors?.description?.message}
            fullWidth
            autoComplete="off"
            multiline
            inputProps={{
              className: 'resize-y min-h-[22px]',
            }}
          />

          <Input
            {...register('instructions')}
            id="instructions"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Instructions</Text>
                <Tooltip title="Instructions for the agent. This is used to instruct the AI agent on how to behave and respond to the user.">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.instructions}
            helperText={errors?.instructions?.message}
            fullWidth
            autoComplete="off"
            multiline
            inputProps={{
              className: 'resize-y min-h-[22px]',
            }}
          />

          <FormSelect
            control={form.control}
            name="provider"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Provider</Text>
                <Tooltip title="The LLM provider to use for this agent.">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4 text-primary"
                  />
                </Tooltip>
              </Box>
            }
            contentClassName="z-[10000]"
            helperText={errors.provider?.message}
          >
            {Object.values(GraphiteAgentProviders_Enum).map((value) => (
              <SelectItem key={value} value={value}>
                {providerLabels[value]}
              </SelectItem>
            ))}
          </FormSelect>

          <Input
            {...register('model')}
            id="model"
            label={
              <Box className="flex flex-row items-center space-x-2">
                <Text>Model</Text>
                <Tooltip title="Model identifier to use (e.g. claude-sonnet-4-20250514, gpt-4o, gemini-2.0-flash).">
                  <InfoIcon
                    aria-label="Info"
                    className="h-4 w-4"
                    color="primary"
                  />
                </Tooltip>
              </Box>
            }
            placeholder=""
            hideEmptyHelperText
            error={!!errors.model}
            helperText={errors?.model?.message}
            fullWidth
            autoComplete="off"
          />

          <ToolsConfigFormSection />
        </div>

        <Box className="flex w-full flex-row justify-between rounded border-t p-4">
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            startIcon={
              agentId ? <RefreshCwIcon width={16} height={16} /> : <PlusIcon />
            }
          >
            {agentId ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}
