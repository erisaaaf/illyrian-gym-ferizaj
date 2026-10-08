import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { SettingsService } from "./settings.service";
import { UpdateGymSettingsDto } from "./dto/update-gym-settings.dto";

@Controller("admin/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Roles(Role.ADMIN)
  @Get("system")
  system() {
    return this.settingsService.system();
  }

  // Any authenticated staff member can view (e.g. to show gym contact info); only ADMIN can edit.
  @Roles(Role.ADMIN, Role.COACH)
  @Get("gym")
  get() {
    return this.settingsService.get();
  }

  @Roles(Role.ADMIN)
  @Patch("gym")
  update(@Body() dto: UpdateGymSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.update(dto, user.sub);
  }
}
