import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { ListBookingsQueryDto } from "./dto/list-bookings.query.dto";

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post("bookings")
  book(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.book(user.sub, dto.classId);
  }

  @Get("bookings/me")
  listMine(@Query() query: ListBookingsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listMine(user.sub, query);
  }

  @HttpCode(HttpStatus.OK)
  @Patch("bookings/:id/cancel")
  cancelMine(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.cancel(id, { userId: user.sub, isAdmin: user.role === Role.ADMIN }, user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("admin/bookings")
  list(@Query() query: ListBookingsQueryDto) {
    return this.bookingsService.list(query);
  }

  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch("admin/bookings/:id/cancel")
  adminCancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.cancel(id, { userId: user.sub, isAdmin: true }, user.sub);
  }
}
