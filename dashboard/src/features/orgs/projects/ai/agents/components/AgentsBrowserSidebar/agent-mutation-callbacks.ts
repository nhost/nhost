interface CreateAgentMutationCallbacksOptions {
  refetchAgents: () => Promise<unknown>;
  redirectAfterDelete?: () => Promise<unknown>;
}

interface AgentMutationCallbacks {
  onSubmit: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function createAgentMutationCallbacks({
  refetchAgents,
  redirectAfterDelete,
}: CreateAgentMutationCallbacksOptions): AgentMutationCallbacks {
  const onSubmit = async () => {
    await refetchAgents();
  };

  const onDelete = async () => {
    await refetchAgents();
    await redirectAfterDelete?.();
  };

  return { onSubmit, onDelete };
}
