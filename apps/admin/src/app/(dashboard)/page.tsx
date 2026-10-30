"use client";

import { useStaffUser } from "../../lib/staff-context";
import { OwnerDashboard } from "../../components/dashboard/owner-dashboard";
import { FrontDeskDashboard } from "../../components/dashboard/front-desk-dashboard";
import { TrainerHome } from "../../components/dashboard/trainer-home";

/** One route, three home screens: each role sees the numbers it is allowed to see (the API enforces the same). */
export default function DashboardHomePage() {
  const { role } = useStaffUser();
  if (role === "ADMIN") return <OwnerDashboard />;
  if (role === "RECEPTIONIST") return <FrontDeskDashboard />;
  return <TrainerHome />;
}
