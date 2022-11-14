import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

type WorkspaceContextData = {
  id: string;
  name: string;
  slug: string;
  app: string;
  appId: string;
  appSlug: string;
  appName: string;
  appSubdomain: string;
  appAdminSecret: string;
  appIsProvisioned: boolean;
  repository: any;
  provisioning: boolean;
};

export type WorkspaceContextContent = {
  workspaceContext: WorkspaceContextData;
  setWorkspaceContext: (d: WorkspaceContextData) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextContent>({
  workspaceContext: {
    id: '',
    name: '',
    slug: '',
    app: '',
    appId: '',
    appSlug: '',
    appName: '',
    appSubdomain: '',
    appAdminSecret: '',
    appIsProvisioned: false,
    repository: '',
    provisioning: false,
  },
  setWorkspaceContext: () => {},
});

export function WorkspaceProvider({ children }: PropsWithChildren<unknown>) {
  const [workspaceContext, setWorkspaceContext] = useState({
    id: '',
    name: '',
    slug: '',
    app: '',
    appId: '',
    appSlug: '',
    appName: '',
    appSubdomain: '',
    appAdminSecret: '',
    appIsProvisioned: false,
    repository: '',
    provisioning: false,
  });

  const value = useMemo(
    () => ({ workspaceContext, setWorkspaceContext }),
    [workspaceContext, setWorkspaceContext],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error(
      `useWorkspaceContext must be used under a WorkspaceContextProvider`,
    );
  }
  return context;
};
