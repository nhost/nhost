import { vi } from 'vitest';
import { usePaletteTrees } from '@/features/command-palette/hooks/usePaletteTrees';
import type { CommandNode } from '@/features/command-palette/types';
import { renderHook } from '@/tests/testUtils';

const findNode = (node: CommandNode, id: string): CommandNode | undefined =>
  node.id === id
    ? node
    : node.children
        ?.map((child) => findNode(child, id))
        .find((match) => match !== undefined);

const getNode = (id: string) => {
  const { result } = renderHook(() => usePaletteTrees());

  return findNode(result.current.tree, id);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('usePaletteTrees', () => {
  it('keeps the Deployments page and its settings on platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');

    const deployments = getNode('project-deployments');

    expect(deployments?.path).toBe('deployments');
    expect(deployments?.children?.map((child) => child.id)).toEqual([
      'project-deployments-deployments',
      'project-deployments-settings',
    ]);
  });

  it('keeps only Deployments settings, as a drill-only group, off-platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'https://config.local');

    const deployments = getNode('project-deployments');

    expect(deployments?.path).toBeUndefined();
    expect(deployments?.children?.map((child) => child.id)).toEqual([
      'project-deployments-settings',
    ]);
  });

  it('drops Deployments off-platform when settings are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');

    expect(getNode('project-deployments')).toBeUndefined();
  });
});
