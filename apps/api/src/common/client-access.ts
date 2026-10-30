import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "./decorators/current-user.decorator";

/**
 * Who may see a member's coaching data (workouts, PRs, plans, reports)?
 *   ADMIN  : everyone (operational view)
 *   COACH  : only the members assigned to them (User.assignedCoachId -> their Coach profile)
 *   others : nobody through these routes
 * Private body data (photos, measurements) is stricter still - see the body-progress module.
 */

/** A Prisma filter selecting the members this viewer may coach-view, or undefined when unrestricted. */
export function clientScope(viewer: AuthenticatedUser): Prisma.UserWhereInput | undefined {
  if (viewer.role === "ADMIN") return undefined;
  if (viewer.role === "COACH") return { assignedCoach: { userId: viewer.sub } };
  throw new ForbiddenException("You do not have access to client data");
}

/** Throws unless the viewer may see this member's coaching data. 404 (not 403) hides whether the member exists. */
export async function assertCanAccessClient(prisma: PrismaService, viewer: AuthenticatedUser, memberId: string): Promise<void> {
  const scope = clientScope(viewer);
  const member = await prisma.client.user.findFirst({ where: { id: memberId, role: "MEMBER", ...(scope ?? {}) }, select: { id: true } });
  if (!member) throw new NotFoundException("Client not found");
}
