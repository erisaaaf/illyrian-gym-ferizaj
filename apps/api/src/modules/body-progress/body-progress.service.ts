import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { assertCanAccessClient } from "../../common/client-access";
import { CreateMeasurementDto, MAX_PHOTOS_PER_MEMBER, MAX_PHOTO_BYTES, UploadPhotoDto } from "./body-progress.dto";

/** Does the file really start like the image type it claims to be? Stops arbitrary content being stored as a "photo". */
export function matchesImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

const MEASUREMENT_FIELDS = ["weightKg", "bodyFatPercent", "chestCm", "waistCm", "hipsCm", "armCm", "thighCm"] as const;

/**
 * Body progress is PRIVATE BY DEFAULT (requirements 3.F). It belongs to the member; the only other person who can ever
 * see any of it is their assigned trainer, and only for items the member explicitly shared. Administrators never see
 * photos and never see measurements - they get operational reports without private data.
 */
@Injectable()
export class BodyProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Measurements (member) -----------------------------------------------------------------------

  async addMeasurement(userId: string, dto: CreateMeasurementDto) {
    if (!MEASUREMENT_FIELDS.some((f) => dto[f] !== undefined)) throw new BadRequestException("Enter at least one measurement");
    const row = await this.prisma.client.bodyMeasurement.create({
      data: { userId, measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(), notes: dto.notes, sharedWithCoach: dto.sharedWithCoach ?? false, ...Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f, dto[f]])) },
    });
    return row;
  }

  listMeasurements(userId: string) {
    return this.prisma.client.bodyMeasurement.findMany({ where: { userId }, orderBy: { measuredAt: "desc" }, take: 200 });
  }

  async setMeasurementShare(userId: string, id: string, shared: boolean) {
    const row = await this.prisma.client.bodyMeasurement.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("Measurement not found");
    const updated = await this.prisma.client.bodyMeasurement.update({ where: { id }, data: { sharedWithCoach: shared } });
    await this.audit.record({ actorId: userId, action: shared ? "body.measurement_shared" : "body.measurement_unshared", entityType: "BodyMeasurement", entityId: id });
    return updated;
  }

  async deleteMeasurement(userId: string, id: string) {
    const row = await this.prisma.client.bodyMeasurement.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("Measurement not found");
    await this.prisma.client.bodyMeasurement.delete({ where: { id } });
    return { ok: true };
  }

  // --- Photos (member) ---------------------------------------------------------------------------------

  async uploadPhoto(userId: string, dto: UploadPhotoDto) {
    const bytes = Buffer.from(dto.dataBase64, "base64");
    if (bytes.length === 0) throw new BadRequestException("The photo is empty");
    if (bytes.length > MAX_PHOTO_BYTES) throw new BadRequestException("The photo is too large (3 MB maximum)");
    if (!matchesImageSignature(bytes, dto.mimeType)) throw new BadRequestException("That file is not a valid image of the stated type");
    if ((await this.prisma.client.progressPhoto.count({ where: { userId } })) >= MAX_PHOTOS_PER_MEMBER) {
      throw new BadRequestException(`You can keep up to ${MAX_PHOTOS_PER_MEMBER} progress photos. Delete an old one first.`);
    }
    const photo = await this.prisma.client.progressPhoto.create({
      data: { userId, takenAt: dto.takenAt ? new Date(dto.takenAt) : new Date(), mimeType: dto.mimeType, sizeBytes: bytes.length, data: bytes, note: dto.note, sharedWithCoach: dto.sharedWithCoach ?? false },
      select: this.META,
    });
    return photo;
  }

  private readonly META = { id: true, takenAt: true, mimeType: true, sizeBytes: true, note: true, sharedWithCoach: true, createdAt: true } as const;

  listPhotos(userId: string) {
    return this.prisma.client.progressPhoto.findMany({ where: { userId }, select: this.META, orderBy: { takenAt: "desc" }, take: MAX_PHOTOS_PER_MEMBER });
  }

  async setPhotoShare(userId: string, id: string, shared: boolean) {
    const row = await this.prisma.client.progressPhoto.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("Photo not found");
    const updated = await this.prisma.client.progressPhoto.update({ where: { id }, data: { sharedWithCoach: shared }, select: this.META });
    await this.audit.record({ actorId: userId, action: shared ? "body.photo_shared" : "body.photo_unshared", entityType: "ProgressPhoto", entityId: id });
    return updated;
  }

  async deletePhoto(userId: string, id: string) {
    const row = await this.prisma.client.progressPhoto.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("Photo not found");
    await this.prisma.client.progressPhoto.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * The image bytes. Allowed for the owner, or for the owner's ASSIGNED trainer when (and only when) the member shared
   * this photo. Everyone else - including administrators - gets 404, which also hides whether the photo exists.
   */
  async image(viewer: AuthenticatedUser, id: string) {
    const photo = await this.prisma.client.progressPhoto.findUnique({ where: { id }, include: { user: { select: { assignedCoach: { select: { userId: true } } } } } });
    const isOwner = photo?.userId === viewer.sub;
    const isSharedWithThisCoach = viewer.role === "COACH" && photo?.sharedWithCoach === true && photo.user.assignedCoach?.userId === viewer.sub;
    if (!photo || !(isOwner || isSharedWithThisCoach)) throw new NotFoundException("Photo not found");
    if (!isOwner) await this.audit.record({ actorId: viewer.sub, action: "body.photo_viewed_by_coach", entityType: "ProgressPhoto", entityId: id, metadata: { ownerId: photo.userId } });
    return { data: Buffer.from(photo.data), mimeType: photo.mimeType };
  }

  // --- The trainer's view: only what the member shared ----------------------------------------------------------

  async sharedWithMe(viewer: AuthenticatedUser, memberId: string) {
    await assertCanAccessClient(this.prisma, viewer, memberId);
    const [measurements, photos] = await Promise.all([
      this.prisma.client.bodyMeasurement.findMany({ where: { userId: memberId, sharedWithCoach: true }, orderBy: { measuredAt: "desc" }, take: 100 }),
      this.prisma.client.progressPhoto.findMany({ where: { userId: memberId, sharedWithCoach: true }, select: this.META, orderBy: { takenAt: "desc" }, take: MAX_PHOTOS_PER_MEMBER }),
    ]);
    return { measurements, photos };
  }
}
