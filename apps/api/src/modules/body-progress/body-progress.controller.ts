import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { BodyProgressService } from "./body-progress.service";
import { CreateMeasurementDto, ShareDto, UploadPhotoDto } from "./body-progress.dto";

/** The member's own private body progress. There is deliberately no route that takes someone else's member id here. */
@Roles(Role.MEMBER)
@Controller("body")
export class BodyProgressController {
  constructor(private readonly body: BodyProgressService) {}

  @Get("measurements")
  measurements(@CurrentUser() user: AuthenticatedUser) {
    return this.body.listMeasurements(user.sub);
  }

  @Post("measurements")
  addMeasurement(@Body() dto: CreateMeasurementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.body.addMeasurement(user.sub, dto);
  }

  @Patch("measurements/:id/share")
  shareMeasurement(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ShareDto, @CurrentUser() user: AuthenticatedUser) {
    return this.body.setMeasurementShare(user.sub, id, dto.sharedWithCoach);
  }

  @Delete("measurements/:id")
  deleteMeasurement(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.body.deleteMeasurement(user.sub, id);
  }

  @Get("photos")
  photos(@CurrentUser() user: AuthenticatedUser) {
    return this.body.listPhotos(user.sub);
  }

  @Post("photos")
  upload(@Body() dto: UploadPhotoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.body.uploadPhoto(user.sub, dto);
  }

  @Patch("photos/:id/share")
  sharePhoto(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ShareDto, @CurrentUser() user: AuthenticatedUser) {
    return this.body.setPhotoShare(user.sub, id, dto.sharedWithCoach);
  }

  @Delete("photos/:id")
  deletePhoto(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.body.deletePhoto(user.sub, id);
  }
}

/** The image bytes: the owner, or their assigned trainer for photos the member shared. Everyone else gets 404. */
@Controller()
export class BodyPhotoImageController {
  constructor(private readonly body: BodyProgressService) {}

  @HttpCode(HttpStatus.OK)
  @Get("body/photos/:id/image")
  async image(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const { data, mimeType } = await this.body.image(user, id);
    res.set({ "Content-Type": mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
    return new StreamableFile(data);
  }
}

/** What a client has shared with their trainer. Trainer only - not the owner. */
@Roles(Role.COACH)
@Controller("clients")
export class SharedBodyController {
  constructor(private readonly body: BodyProgressService) {}

  @Get(":id/body")
  shared(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.body.sharedWithMe(user, id);
  }
}
