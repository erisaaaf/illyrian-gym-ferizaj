import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "./decorators/current-user.decorator";

/**
 * Admins can manage any class. A trainer can only manage (see participants of,
 * check people into) classes assigned to them. Throws 404 for an unknown class
 * and 403 for someone else's class.
 */
export async function assertCanManageClass(prisma: PrismaService, classId: string, user: AuthenticatedUser) {
  const cls = await prisma.client.class.findUnique({
    where: { id: classId },
    include: { coach: { select: { userId: true } } },
  });
  if (!cls) throw new NotFoundException("Class not found");
  if (user.role === "COACH" && cls.coach?.userId !== user.sub) {
    throw new ForbiddenException("You can only manage classes assigned to you");
  }
  return cls;
}
