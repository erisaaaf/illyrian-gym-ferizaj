"use client";

import { createContext, ReactNode, useContext } from "react";
import type { StaffRole } from "./nav";

export interface StaffUser {
  firstName: string;
  lastName: string;
  role: StaffRole;
}

const StaffContext = createContext<StaffUser | null>(null);

export function StaffProvider({ user, children }: { user: StaffUser; children: ReactNode }) {
  return <StaffContext.Provider value={user}>{children}</StaffContext.Provider>;
}

/** The signed-in staff member. Use it to choose what to show; the API enforces the same permissions regardless. */
export function useStaffUser(): StaffUser {
  const user = useContext(StaffContext);
  if (!user) throw new Error("useStaffUser must be used inside the dashboard shell");
  return user;
}
