import { createContext, useContext } from "react";
import type { AccessState } from "@/hooks/useAccess";

export const AccessContext = createContext<AccessState | null>(null);

export function useAccessContext(): AccessState | null {
  return useContext(AccessContext);
}
