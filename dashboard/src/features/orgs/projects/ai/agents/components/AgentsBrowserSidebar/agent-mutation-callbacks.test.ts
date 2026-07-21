import { vi } from 'vitest';
import { createAgentMutationCallbacks } from '@/features/orgs/projects/ai/agents/components/AgentsBrowserSidebar/agent-mutation-callbacks';

describe('createAgentMutationCallbacks', () => {
  it('refetches the agents query after create and edit submissions', async () => {
    const refetchAgents = vi.fn().mockResolvedValue(undefined);
    const { onSubmit } = createAgentMutationCallbacks({ refetchAgents });

    await onSubmit();
    await onSubmit();

    expect(refetchAgents).toHaveBeenCalledTimes(2);
  });

  it('refetches the agents query after deleting an unselected agent', async () => {
    const refetchAgents = vi.fn().mockResolvedValue(undefined);
    const { onDelete } = createAgentMutationCallbacks({ refetchAgents });

    await onDelete();

    expect(refetchAgents).toHaveBeenCalledOnce();
  });

  it('refetches before redirecting after deleting the selected agent', async () => {
    const calls: string[] = [];
    const refetchAgents = vi.fn().mockImplementation(async () => {
      calls.push('refetch');
    });
    const redirectAfterDelete = vi.fn().mockImplementation(async () => {
      calls.push('redirect');
    });
    const { onDelete } = createAgentMutationCallbacks({
      refetchAgents,
      redirectAfterDelete,
    });

    await onDelete();

    expect(calls).toEqual(['refetch', 'redirect']);
    expect(redirectAfterDelete).toHaveBeenCalledOnce();
  });
});
