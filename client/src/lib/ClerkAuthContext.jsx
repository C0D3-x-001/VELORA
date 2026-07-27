import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { isClerkConfigured } from "./clerkConfig";

export const ClerkAuthCtx = createContext({ clerkAvailable: isClerkConfigured(), markClerkFailed: () => {} });

export function ClerkAuthProvider({ children }) {
  const [clerkFailed, setClerkFailed] = useState(false);
  const clerkConfigured = isClerkConfigured();
  const clerkAvailable = clerkConfigured && !clerkFailed;

  const markClerkFailed = useCallback(() => setClerkFailed(true), []);
  const value = useMemo(() => ({ clerkAvailable, markClerkFailed }), [clerkAvailable, markClerkFailed]);

  return (
    <ClerkAuthCtx.Provider value={value}>
      {children}
    </ClerkAuthCtx.Provider>
  );
}

export function useClerkAuth() {
  return useContext(ClerkAuthCtx);
}
