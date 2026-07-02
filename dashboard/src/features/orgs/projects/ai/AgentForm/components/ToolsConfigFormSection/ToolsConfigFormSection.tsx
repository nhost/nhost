import { useFieldArray, useFormContext } from 'react-hook-form';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Input } from '@/components/ui/v2/Input';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { AgentFormValues } from '@/features/orgs/projects/ai/AgentForm/AgentForm';

function SectionHeader({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <Box className="flex flex-row items-center space-x-2">
      <Text variant="h4" className="font-semibold">
        {title}
      </Text>
      <Tooltip title={tooltip}>
        <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
      </Tooltip>
    </Box>
  );
}

function WebSearchSection() {
  const {
    watch,
    formState: { errors },
  } = useFormContext<AgentFormValues>();
  const enabled = watch('webSearchEnabled');

  return (
    <Box className="space-y-3 rounded border p-4">
      <Box className="flex flex-row items-center justify-between">
        <SectionHeader
          title="Web Search"
          tooltip="Enable web search capability using Brave or Tavily."
        />
        <ControlledCheckbox name="webSearchEnabled" />
      </Box>

      {enabled && (
        <Box className="flex flex-col space-y-3 pl-1">
          <ControlledSelect
            slotProps={{
              popper: { disablePortal: false, className: 'z-[10000]' },
            }}
            id="webSearchProvider"
            name="webSearchProvider"
            label="Provider"
            fullWidth
            error={!!errors.webSearchProvider}
            helperText={errors.webSearchProvider?.message}
          >
            <Option value="brave">Brave</Option>
            <Option value="tavily">Tavily</Option>
          </ControlledSelect>
          <ControlledCheckbox
            name="webSearchRequireApproval"
            label="Require approval"
          />
        </Box>
      )}
    </Box>
  );
}

function WebFetchSection() {
  const { watch } = useFormContext<AgentFormValues>();
  const enabled = watch('webFetchEnabled');

  return (
    <Box className="space-y-3 rounded border p-4">
      <Box className="flex flex-row items-center justify-between">
        <SectionHeader
          title="Web Fetch"
          tooltip="Enable fetching web page content and converting to markdown."
        />
        <ControlledCheckbox name="webFetchEnabled" />
      </Box>

      {enabled && (
        <Box className="pl-1">
          <ControlledCheckbox
            name="webFetchRequireApproval"
            label="Require approval"
          />
        </Box>
      )}
    </Box>
  );
}

function GraphQLSection() {
  const { watch } = useFormContext<AgentFormValues>();
  const enabled = watch('graphqlEnabled');

  return (
    <Box className="space-y-3 rounded border p-4">
      <Box className="flex flex-row items-center justify-between">
        <SectionHeader
          title="GraphQL"
          tooltip="Enable GraphQL schema introspection, queries, and mutations."
        />
        <ControlledCheckbox name="graphqlEnabled" />
      </Box>

      {enabled && (
        <Box className="flex flex-col space-y-2 pl-1">
          <ControlledCheckbox
            name="graphqlRequireApprovalQueries"
            label="Require approval for queries"
          />
          <ControlledCheckbox
            name="graphqlRequireApprovalMutations"
            label="Require approval for mutations"
          />
        </Box>
      )}
    </Box>
  );
}

function McpServersSection() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<AgentFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: 'mcpServers',
  });

  return (
    <Box className="space-y-3 rounded border p-4">
      <Box className="flex flex-row items-center justify-between">
        <SectionHeader
          title="MCP Servers"
          tooltip="Connect to Model Context Protocol servers to provide additional tools."
        />
        <Button
          variant="borderless"
          onClick={() =>
            append({
              url: '',
              headers: '',
              requireApproval: false,
              toolOverrides: '',
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      {fields.map((field, index) => {
        const serverErrors = errors.mcpServers?.[index];
        const requireApproval = watch(
          `mcpServers.${index}.requireApproval` as const,
        );

        return (
          <Box key={field.id} className="flex flex-col space-y-3">
            {index > 0 && (
              <Divider className="h-px" sx={{ background: 'grey.200' }} />
            )}

            <Input
              {...register(`mcpServers.${index}.url` as const)}
              id={`mcp-${field.id}-url`}
              label="URL"
              placeholder="https://mcp-server.example.com/sse"
              hideEmptyHelperText
              error={!!serverErrors?.url}
              helperText={serverErrors?.url?.message}
              fullWidth
              autoComplete="off"
            />

            <Input
              {...register(`mcpServers.${index}.headers` as const)}
              id={`mcp-${field.id}-headers`}
              label={
                <Box className="flex flex-row items-center space-x-2">
                  <Text>Headers</Text>
                  <Tooltip title='Optional HTTP headers as JSON, e.g. {"Authorization": "Bearer ..."}'>
                    <InfoIcon
                      aria-label="Info"
                      className="h-4 w-4"
                      color="primary"
                    />
                  </Tooltip>
                </Box>
              }
              placeholder="{}"
              hideEmptyHelperText
              error={!!serverErrors?.headers}
              helperText={serverErrors?.headers?.message}
              fullWidth
              autoComplete="off"
              multiline
              inputProps={{
                className: 'resize-y min-h-[22px] font-mono text-sm',
              }}
            />

            <ControlledCheckbox
              name={`mcpServers.${index}.requireApproval`}
              label="Require approval (default for all tools)"
            />

            {requireApproval && (
              <Input
                {...register(`mcpServers.${index}.toolOverrides` as const)}
                id={`mcp-${field.id}-toolOverrides`}
                label={
                  <Box className="flex flex-row items-center space-x-2">
                    <Text>Tool Overrides</Text>
                    <Tooltip title='Per-tool approval overrides as JSON, e.g. {"safe_tool": {"require_approval": false}}'>
                      <InfoIcon
                        aria-label="Info"
                        className="h-4 w-4"
                        color="primary"
                      />
                    </Tooltip>
                  </Box>
                }
                placeholder="{}"
                hideEmptyHelperText
                error={!!serverErrors?.toolOverrides}
                helperText={serverErrors?.toolOverrides?.message}
                fullWidth
                autoComplete="off"
                multiline
                inputProps={{
                  className: 'resize-y min-h-[22px] font-mono text-sm',
                }}
              />
            )}

            <Button
              variant="borderless"
              className="h-10 self-end"
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        );
      })}
    </Box>
  );
}

export default function ToolsConfigFormSection() {
  return (
    <Box className="flex flex-col space-y-4">
      <Text variant="h3" className="font-semibold">
        Tools
      </Text>
      <WebSearchSection />
      <WebFetchSection />
      <GraphQLSection />
      <McpServersSection />
    </Box>
  );
}
