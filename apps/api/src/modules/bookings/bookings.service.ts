import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookingStatus, ClassStatus, NotificationType, Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { computeMembershipStatus } from "../../common/membership-status.util";
import { ListBookingsQueryDto } from "./dto/list-bookings.query.dto";

const BOOKING_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  class: { select: { id: true, title: true, startTime: true, endTime: true, capacity: true, bookedCount: true } },
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The core booking flow (spec section 17). Runs the capacity check as a
   * conditional UPDATE inside the transaction rather than
   * read-compare-write, so two simultaneous requests against the last
   * remaining spot can never both succeed - see docs/database.md.
   */
  async book(userId: string, classId: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new ForbiddenException("Your account is not active");
    }

    const membership = await this.prisma.client.membership.findFirst({
      where: { userId },
      orderBy: { endDate: "desc" },
    });
    const membershipStatus = membership ? computeMembershipStatus(membership) : "NONE";
    if (membershipStatus === "EXPIRED" || membershipStatus === "CANCELLED" || membershipStatus === "NONE") {
      throw new ForbiddenException("An active membership is required to book a class");
    }

    const cls = await this.prisma.client.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException("Class not found");
    if (cls.status !== ClassStatus.SCHEDULED) throw new BadRequestException("This class is not open for booking");
    if (cls.endTime <= new Date()) throw new BadRequestException("This class has already taken place");

    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const incremented = await tx.$executeRaw`
          UPDATE "Class" SET "bookedCount" = "bookedCount" + 1
          WHERE id = ${classId} AND "bookedCount" < capacity AND status = 'SCHEDULED'
        `;

        const status: BookingStatus = incremented === 1 ? BookingStatus.BOOKED : BookingStatus.WAITLISTED;

        const booking = await tx.booking.create({
          data: { userId, classId, status },
          include: BOOKING_INCLUDE,
        });

        await tx.notification.create({
          data: {
            userId,
            type: NotificationType.BOOKING_CONFIRMATION,
            title: status === "BOOKED" ? "Booking confirmed" : "Added to waitlist",
            body:
              status === "BOOKED"
                ? `You're booked for ${booking.class.title} on ${booking.class.startTime.toLocaleString()}.`
                : `${booking.class.title} is full - you're on the waitlist and will be notified if a spot opens up.`,
            data: { bookingId: booking.id, classId },
          },
        });

        return booking;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You already have an active booking for this class");
      }
      throw err;
    }
  }

  async cancel(bookingId: string, requester: { userId: string; isAdmin: boolean }, actorId: string) {
    const booking = await this.prisma.client.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!requester.isAdmin && booking.userId !== requester.userId) {
      throw new ForbiddenException("You can only cancel your own bookings");
    }
    if (booking.status === "CANCELLED") return booking;
    if (booking.status !== "BOOKED" && booking.status !== "WAITLISTED") {
      throw new BadRequestException("This booking can no longer be cancelled");
    }

    const wasBooked = booking.status === "BOOKED";

    const result = await this.prisma.client.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
        include: BOOKING_INCLUDE,
      });

      if (wasBooked) {
        await tx.class.update({ where: { id: booking.classId }, data: { bookedCount: { decrement: 1 } } });

        // Promote the longest-waiting waitlisted booking into the freed spot.
        const nextWaiting = await tx.booking.findFirst({
          where: { classId: booking.classId, status: BookingStatus.WAITLISTED },
          orderBy: { bookedAt: "asc" },
        });
        if (nextWaiting) {
          await tx.booking.update({ where: { id: nextWaiting.id }, data: { status: BookingStatus.BOOKED } });
          await tx.class.update({ where: { id: booking.classId }, data: { bookedCount: { increment: 1 } } });
          await tx.notification.create({
            data: {
              userId: nextWaiting.userId,
              type: NotificationType.BOOKING_CONFIRMATION,
              title: "You're off the waitlist!",
              body: "A spot opened up and you're now booked for this class.",
              data: { bookingId: nextWaiting.id, classId: booking.classId },
            },
          });
        }
      }

      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: NotificationType.BOOKING_CANCELLATION,
          title: "Booking cancelled",
          body: `Your booking for ${cancelled.class.title} has been cancelled.`,
          data: { bookingId: booking.id },
        },
      });

      return cancelled;
    });

    await this.audit.record({
      actorId,
      action: "booking.cancel",
      entityType: "Booking",
      entityId: bookingId,
      metadata: { byAdmin: requester.isAdmin },
    });

    return result;
  }

  async listMine(userId: string, query: ListBookingsQueryDto) {
    return this.list({ ...query, userId });
  }

  async list(query: ListBookingsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.BookingWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { bookedAt: "desc" },
        ...skipTake(page, pageSize),
      }),
      this.prisma.client.booking.count({ where }),
    ]);

    return paginate(data, total, page, pageSize);
  }
}
