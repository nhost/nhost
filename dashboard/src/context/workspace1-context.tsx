import type { Workspace } from '@/types/workspace';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

type Metadata = {
  lastWorkspace: string;
  template?: string;
};

type UserContextData = {
  workspaces: Workspace[];
  metadata?: Metadata;
};

export type UserDataContent = {
  userContext: UserContextData;
  setUserContext: (d: UserContextData) => void;
};

export const UserDataContext = createContext<UserDataContent>({
  userContext: {
    workspaces: [],
    metadata: { lastWorkspace: '' },
  },
  setUserContext: () => {},
});

export function UserDataProvider({ children }: PropsWithChildren<unknown>) {
  const [userContext, setUserContext] = useState({
    workspaces: [],
    metadata: {},
  });

  const value = useMemo(
    () => ({ userContext, setUserContext }),
    [userContext, setUserContext],
  );

  return (
    // @ts-ignore
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}

export const useUserDataContext = () => {
  const context = useContext(UserDataContext);

  if (context === undefined) {
    throw new Error(`useUserDataContext must be used under a UserDataProvider`);
  }
  return context;
};
