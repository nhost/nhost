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

// Sections whose page is platform-only but whose settings are not.
describe.each([
  ['Deployments', 'deployments'],
  ['Metrics', 'metrics'],
])('usePaletteTrees: %s', (_name, slug) => {
  const groupId = `project-${slug}`;

  it('keeps the page and its settings on platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');

    const group = getNode(groupId);

    expect(group?.path).toBe(slug);
    expect(group?.children?.map((child) => child.id)).toEqual([
      `${groupId}-${slug}`,
      `${groupId}-settings`,
    ]);
  });

  it('keeps only the settings, as a drill-only group, off-platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://my-config-server.com',
    );

    const group = getNode(groupId);

    expect(group?.path).toBeUndefined();
    expect(group?.children?.map((child) => child.id)).toEqual([
      `${groupId}-settings`,
    ]);
  });

  it('drops the group off-platform when settings are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');

    expect(getNode(groupId)).toBeUndefined();
  });
});
