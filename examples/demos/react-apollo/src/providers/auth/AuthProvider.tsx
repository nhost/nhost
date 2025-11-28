import { useNhostClient } from "@/providers/nhost/";
import { type Session } from "@nhost/nhost-js/auth";
import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { AuthContext, type AuthContextType } from "./AuthContext";

function AuthProvider({ children }: PropsWithChildren) {
  const nhost = useNhostClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const unsubscribe = nhost.sessionStorage.onChange(setSession);
    function storageEventListener(event: StorageEvent) {
      if (event.key === "nhostSession") {
        const newSession = event.newValue
          ? (JSON.parse(event.newValue) as Session)
          : null;
        setSession(newSession);
      }
    }

    // Check for session changes when page becomes visible or focused
    const checkSessionOnFocus = () => {
      const currentSession = nhost.getUserSession();
      setSession(currentSession);
    };

    // Monitor page visibility changes (tab switching, window minimizing)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkSessionOnFocus();
      }
    };

    window.addEventListener("storage", storageEventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkSessionOnFocus);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", storageEventListener);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkSessionOnFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function initializeSession() {
      setIsLoading(true);
      // reset state if we have just signed out
      setIsSigningOut(false);

      const currentSession = nhost.getUserSession();
      setSession(currentSession);

      setIsLoading(false);
    }
    initializeSession();
  }, [nhost]);

  const value: AuthContextType = useMemo(
    () => ({
      user: session?.user || null,
      session,
      isAuthenticated: !!session,
      isLoading,
      isSigningOut,
      signout: async () => {
        setSession(null);
        setIsSigningOut(true);
        await nhost.auth.signOut({
          refreshToken: session!.refreshToken,
        });
      },
      updateSession(newSession) {
        setSession(newSession);
      },
      clearIsSigningOut() {
        setIsSigningOut(false);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
