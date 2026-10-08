import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { PrismaService } from "../../../prisma/prisma.service";

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt-access") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET")!,
    });
  }

  // The token proves who the caller is; the database decides whether they may
  // still act. Re-reading status and role on every request means deactivating
  // an account or changing its role takes effect immediately instead of when
  // the (up to 15 minute) access token expires.
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, role: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.status !== "ACTIVE") {
      throw new UnauthorizedException("This account is not active");
    }
    return { sub: payload.sub, email: user.email, role: user.role };
  }
}
